import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, setDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Plus, Loader, FileText, Trash2, Edit3, ChevronRight, ChevronLeft, FlaskConical, Beaker, CheckCircle, ChevronDown, Upload, Download, Layers, FolderPlus, X, Zap, Folder, Search, Copy } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { toast } from 'react-toastify';

/* ─── Tiny reusable primitives ───────────────────────────────────────────── */
const Label = ({ children }) => (
  <label className="block text-[12px] font-semibold text-[#98A2B3] uppercase tracking-wider mb-1.5 ml-1">{children}</label>
);
const Input = React.forwardRef(({ className = '', ...props }, ref) => (
  <input
    ref={ref}
    className={`w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-[13px] font-bold text-[#1F2937] outline-none focus:border-[#1E2A5A]/30 focus:ring-4 focus:ring-[#1E2A5A]/10 transition-all placeholder:text-[#98A2B3] shadow-sm ${className}`}
    {...props}
  />
));
Input.displayName = 'Input';
const Select = ({ className = '', children, ...props }) => (
  <select
    className={`w-full px-4 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-[13px] font-bold text-[#1F2937] outline-none focus:border-[#1E2A5A]/30 focus:ring-4 focus:ring-[#1E2A5A]/10 transition-all appearance-none cursor-pointer shadow-sm ${className}`}
    {...props}
  >
    {children}
  </select>
);
const SectionTag = ({ color = 'blue', children }) => {
  const colors = {
    blue: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    purple: 'bg-[#1E2A5A] text-white border-[#1E2A5A]',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
  };
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest border shadow-sm ${colors[color]}`}>{children}</span>
      <div className="h-px bg-slate-100 flex-grow" />
    </div>
  );
};

const Tests = () => {
  const { userData, activeLabId } = useAuth();
  const isSuperAdmin = userData?.role === 'SuperAdmin';
  const isLabAdmin   = userData?.role === 'LabAdmin';
  const canEditFull  = isSuperAdmin || isLabAdmin;
  const [tests, setTests]     = useState([]);

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const csvInputRef = React.useRef(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  
  const navigate = useNavigate();
  const location = useLocation();
  const priceInputRef = React.useRef(null);
  const [sourceFromUrl, setSourceFromUrl] = useState(null);

  const [testForm, setTestForm] = useState({
    testCode: '', testName: '', category: 'Hematology',
    sampleType: 'Whole Blood (EDTA)', methodology: '',
    tatHours: '24 hrs', price: 0, groups: [], status: 'active',
    reportLayout: 'Standard',
  });
  const [newGroupName, setNewGroupName] = useState('');
  const [paramInput, setParamInput] = useState({ code: '', name: '', unit: '', dataType: 'Quantitative', decimals: 2 });
  const [ruleInput,  setRuleInput]  = useState({ gender: 'Any', ageMin: 0, ageMax: 120, ageUnit: 'Years', normalRange: '', criticalLow: '', criticalHigh: '' });
  const [selectedGroupIndex, setSelectedGroupIndex] = useState(-1);
  const [selectedParamIndex, setSelectedParamIndex] = useState(-1);
  const [selectedRuleIndex,  setSelectedRuleIndex]  = useState(-1);
  const [originalParamData, setOriginalParamData] = useState(null);
  const [originalRuleData, setOriginalRuleData] = useState(null);
  // Master Parameter Library
  const [masterParams, setMasterParams] = useState([]);
  const [paramSearch, setParamSearch] = useState('');
  const [showParamLibraryMenu, setShowParamLibraryMenu] = useState(false);
  const paramSearchInputRef = React.useRef(null);

  useEffect(() => { if (showModal && canEditFull) fetchMasterParams(); }, [showModal]);


  const fetchMasterParams = async () => {
    try {
      const snap = await getDocs(collection(db, 'masterParameters'));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setMasterParams(items);
    } catch (e) { console.warn('Master params fetch failed', e.message); }
  };

  useEffect(() => { fetchTests(); }, [userData, activeLabId]);

  const fetchTests = async () => {
    if (!activeLabId && userData?.role !== 'SuperAdmin') return;
    setLoading(true);
    try {
      let q;
      if (isSuperAdmin && activeLabId) {
        // SuperAdmin managing a specific lab: show only that lab's tests + GLOBAL
        const labIdVal = isNaN(activeLabId) ? activeLabId : String(activeLabId);
        q = query(collection(db, 'tests'), where('labId', 'in', [labIdVal, 'GLOBAL']));
      } else if (isSuperAdmin) {
        // SuperAdmin with no lab selected: show all tests
        q = query(collection(db, 'tests'));
      } else {
        // Lab users see their lab's tests AND Global tests
        const labIdVal = isNaN(activeLabId) ? activeLabId : String(activeLabId);
        q = query(collection(db, 'tests'), where('labId', 'in', [labIdVal, 'GLOBAL']));
      }
      
      const snap = await getDocs(q);
      let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // DEDUPLICATION: Hide GLOBAL versions if a Lab-specific version exists
      if (activeLabId) {
        const labIdVal = isNaN(activeLabId) ? activeLabId : String(activeLabId);
        const labSpecific = results.filter(t => t.labId === labIdVal);
        const globalTests = results.filter(t => t.labId === 'GLOBAL');
        
        // Use a Set of testCodes to quickly check existence
        const labTestCodes = new Set(labSpecific.map(t => t.testCode));
        
        // Filter global tests: Keep only those that don't have a lab-specific override
        const uniqueGlobal = globalTests.filter(gt => !labTestCodes.has(gt.testCode));
        
        results = [...labSpecific, ...uniqueGlobal];
      }

      // Sort: Global tests first, then by name
      results.sort((a, b) => {
        if (a.isGlobal && !b.isGlobal) return -1;
        if (!a.isGlobal && b.isGlobal) return 1;
        return a.testName?.localeCompare(b.testName || '');
      });
      
      setTests(results);
    } catch (e) { 
      console.error("Fetch Tests Error:", e);
    }
    finally { setLoading(false); }
  };

  const handleOpenEdit = (test) => {
    setTestForm({ ...test, groups: test.groups || [] });
    setShowModal(true);
    // Focus price input after modal opens
    setTimeout(() => {
      priceInputRef.current?.focus();
      priceInputRef.current?.select();
    }, 400);
  };

  // Deep-link to edit test if 'edit' param exists in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editId = params.get('edit');
    const source = params.get('source');
    
    if (source && !sourceFromUrl) setSourceFromUrl(source);

    if (editId && tests.length > 0) {
      const testToEdit = tests.find(t => t.id === editId);
      if (testToEdit) {
        handleOpenEdit(testToEdit);
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, [location.search, tests, sourceFromUrl]);
  
  // ─── Filters & Counts ──────────────────────────────────────────────────
  const statusCounts = React.useMemo(() => {
    const counts = { All: tests.length, Active: 0, Inactive: 0 };
    tests.forEach(t => {
      if (t.status === 'inactive') counts.Inactive++;
      else counts.Active++;
    });
    return counts;
  }, [tests]);

  const filteredTests = React.useMemo(() => {
    return tests.filter(t => {
      const nameMatch = t.testName?.toLowerCase().includes(searchTerm.toLowerCase());
      const codeMatch = t.testCode?.toLowerCase().includes(searchTerm.toLowerCase());
      const categoryMatch = t.category?.toLowerCase().includes(searchTerm.toLowerCase());
      return nameMatch || codeMatch || categoryMatch;
    });
  }, [tests, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, rowsPerPage]);

  const paginatedTests = React.useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return filteredTests.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredTests, currentPage, rowsPerPage]);

  const getParamCount = (test) =>
    test.groups?.length
      ? test.groups.reduce((s, g) => s + (g.parameters?.length || 0), 0)
      : test.parameters?.length || 0;

  const handleDeleteTest = async (id) => {
    // GUARD: Strictly Super Admin only for catalog deletion
    if (userData?.role !== 'SuperAdmin') {
      toast.error("Unauthorized: Only Super Admin can delete tests from the catalog.");
      return;
    }

    const testData = tests.find(t => t.id === id);
    toast(
      ({ closeToast }) => (
        <div>
          <p style={{ fontWeight: 800, marginBottom: 4, fontSize: 13 }}>Delete "{testData?.testName || 'Test'}"?</p>
          <p style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>This action cannot be undone.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={async () => {
                closeToast();
                const toastId = toast.loading('Deleting test...');
                try {
                  await deleteDoc(doc(db, 'tests', id));
                  setTests(p => p.filter(t => t.id !== id));
                  toast.update(toastId, { render: 'Test deleted successfully', type: 'success', isLoading: false, autoClose: 2000 });
                } catch (e) {
                  toast.update(toastId, { render: 'Delete failed: ' + e.message, type: 'error', isLoading: false, autoClose: 4000 });
                }
              }}
              style={{ padding: '6px 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 11, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Confirm Delete
            </button>
            <button
              onClick={closeToast}
              style={{ padding: '6px 16px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: 11, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              Cancel
            </button>
          </div>
        </div>
      ),
      { autoClose: false, closeOnClick: false, draggable: false, position: 'top-center' }
    );
  };

  // ── Clone Test ───────────────────────────────────────────────────────────
  const handleCloneTest = async (test) => {
    if (!activeLabId) return toast.error('Please select a lab first.');
    const labIdVal = isNaN(activeLabId) ? activeLabId : String(activeLabId);
    const alreadyExists = tests.some(t => t.labId === labIdVal && t.testCode === test.testCode);
    if (alreadyExists) return toast.warning(`A local copy of "${test.testName}" already exists for this lab.`);
    if (!window.confirm(`Clone "${test.testName}" as a local copy for this lab?`)) return;
    try {
      const { id, labId, isGlobal, createdAt, updatedAt, ...rest } = test;
      await addDoc(collection(db, 'tests'), {
        ...rest,
        labId: labIdVal,
        isGlobal: false,
        clonedFrom: id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await fetchTests();
      alert(`✅ "${test.testName}" cloned successfully! You can now edit price and other details.`);
    } catch (e) { alert('Clone failed: ' + e.message); }
  };

  // ── CSV (Flat Format) ────────────────────────────────────────
  // Columns: test_name, test_code, category, group_name, parameter_code,
  //          parameter_name, unit, type, decimals, gender, age_min, age_max,
  //          age_unit, normal_min, normal_max, critical_min, critical_max
  const handleDownloadSampleCSV = () => {
    const H = ['test_name','test_code','category','group_name','parameter_code','parameter_name','unit','type','decimals','gender','age_min','age_max','age_unit','normal_min','normal_max','critical_min','critical_max'];
    const rows = [H,
      ['Complete Blood Count','CBC01','Hematology','General',         'HGB', 'Hemoglobin',          'g/dL',    'Quantitative','2','Male',  '18','120','Years','13.8','17.2','7.0', '20.0'],
      ['Complete Blood Count','CBC01','Hematology','General',         'HGB', 'Hemoglobin',          'g/dL',    'Quantitative','2','Female','18','120','Years','12.1','15.1','7.0', '20.0'],
      ['Complete Blood Count','CBC01','Hematology','General',         'TLC', 'Total Leucocyte Count','10^3/µL', 'Quantitative','2','Any',   '18','120','Years','4.0', '11.0','2.0', '30.0'],
      ['Complete Blood Count','CBC01','Hematology','WBC Series',      'NEU', 'Neutrophils',          '%',       'Quantitative','1','Any',   '18','120','Years','40.0','70.0','',    ''    ],
      ['Complete Blood Count','CBC01','Hematology','WBC Series',      'LYM', 'Lymphocytes',          '%',       'Quantitative','1','Any',   '18','120','Years','20.0','40.0','',    ''    ],
      ['Complete Blood Count','CBC01','Hematology','WBC Series',      'MON', 'Monocytes',            '%',       'Quantitative','1','Any',   '18','120','Years','2.0', '10.0','',    ''    ],
      ['Complete Blood Count','CBC01','Hematology','WBC Series',      'EOS', 'Eosinophils',          '%',       'Quantitative','1','Any',   '18','120','Years','1.0', '4.0', '',    ''    ],
      ['Complete Blood Count','CBC01','Hematology','RBC Series',      'RBC', 'RBC Count',            '10^6/µL', 'Quantitative','2','Male',  '18','120','Years','4.5', '5.9', '2.0', '8.0' ],
      ['Complete Blood Count','CBC01','Hematology','RBC Series',      'RBC', 'RBC Count',            '10^6/µL', 'Quantitative','2','Female','18','120','Years','3.8', '5.2', '2.0', '8.0' ],
      ['Complete Blood Count','CBC01','Hematology','RBC Series',      'MCV', 'MCV',                  'fL',      'Quantitative','1','Any',   '18','120','Years','80.0','100','',    ''    ],
      ['Complete Blood Count','CBC01','Hematology','RBC Series',      'MCH', 'MCH',                  'pg',      'Quantitative','1','Any',   '18','120','Years','27.0','32.0','',    ''    ],
      ['Complete Blood Count','CBC01','Hematology','RBC Series',      'MCHC','MCHC',                 'g/dL',    'Quantitative','1','Any',   '18','120','Years','32.0','36.0','',    ''    ],
      ['Complete Blood Count','CBC01','Hematology','RBC Series',      'HCT', 'Hematocrit',           '%',       'Quantitative','1','Male',  '18','120','Years','40.0','52.0','',    ''    ],
      ['Complete Blood Count','CBC01','Hematology','RBC Series',      'HCT', 'Hematocrit',           '%',       'Quantitative','1','Female','18','120','Years','36.0','48.0','',    ''    ],
      ['Complete Blood Count','CBC01','Hematology','Platelet Series', 'PLT', 'Platelet Count',        '10^3/µL', 'Quantitative','0','Any',   '18','120','Years','150', '400', '50',  '1000'],
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'sample_tests_flat.csv'
    });
    a.click();
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    e.target.value = ''; 
    if (!isSuperAdmin) return alert('❌ Only SuperAdmin can import tests.');
    if (!activeLabId) { alert('Select a lab first.'); return; }
    setCsvImporting(true);
    try {
      const lines = (await file.text()).split(/\r?\n/).filter(l => l.trim());
      const parseRow = (line) => {
        const r=[]; let c='',q=false;
        for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(q&&line[i+1]==='"'){c+='"';i++;}else q=!q;}else if(ch===','&&!q){r.push(c.trim());c='';}else c+=ch;}
        r.push(c.trim()); return r;
      };
      const headers = parseRow(lines.shift());
      const col = (row, name) => row[headers.indexOf(name)] || '';
      const testsMap = {};
      for (const line of lines) {
        if (!line.trim()) continue;
        const row = parseRow(line);
        const testCode  = col(row,'test_code'),  testName  = col(row,'test_name');
        const category  = col(row,'category')  || 'General';
        const groupName = col(row,'group_name') || 'General';
        const paramCode = col(row,'parameter_code'), paramName = col(row,'parameter_name');
        if (!testName || !paramName) continue;
        const tKey = testCode || testName;
        if (!testsMap[tKey]) testsMap[tKey] = {
          testCode, testName, category, sampleType:'Whole Blood (EDTA)',
          methodology:'', tatHours:'24 hrs', price:0,
          labId:activeLabId, createdAt:serverTimestamp(), groups:{}
        };
        const t = testsMap[tKey];
        if (!t.groups[groupName]) t.groups[groupName] = { params:{} };
        const pKey = paramCode || paramName;
        if (!t.groups[groupName].params[pKey]) {
          t.groups[groupName].params[pKey] = {
            code:paramCode, name:paramName, unit:col(row,'unit'),
            dataType:col(row,'type')||'Quantitative',
            decimals:parseInt(col(row,'decimals'))||2, rules:[]
          };
        }
        const normalMin = col(row,'normal_min'), normalMax = col(row,'normal_max');
        if (normalMin || normalMax) {
          t.groups[groupName].params[pKey].rules.push({
            gender:col(row,'gender')||'Any',
            ageMin:parseFloat(col(row,'age_min'))||0,
            ageMax:parseFloat(col(row,'age_max'))||120,
            ageUnit:col(row,'age_unit')||'Years',
            normalRange:`${normalMin} - ${normalMax}`,
            criticalLow:col(row,'critical_min'),
            criticalHigh:col(row,'critical_max'),
          });
        }
      }
      let tN=0,pN=0,rN=0;
      for (const testData of Object.values(testsMap)) {
        const orderedGroups = Object.entries(testData.groups).map(([gName,gData],gi) => ({
          group_name:gName, group_order:gi, collapsed:false,
          parameters:Object.values(gData.params).map((p,pi)=>{ pN++;rN+=p.rules.length; return{...p,parameter_order:pi}; })
        }));
        await addDoc(collection(db,'tests'), { ...testData, groups:orderedGroups });
        tN++;
      }
      await fetchTests();
      alert(`✅ Imported: ${tN} Test${tN!==1?'s':''}, ${pN} Parameters, ${rN} Rules`);
    } catch(err){ alert('❌ Import failed: '+err.message); }
    finally { setCsvImporting(false); }
  };

  // ── Form Handlers ────────────────────────────────────────────────────────
  const resetForm = () => {
    setTestForm({ testCode:'',testName:'',category:'Hematology',sampleType:'Whole Blood (EDTA)',methodology:'',tatHours:'24 hrs',price:0,groups:[], status: 'active', reportLayout: 'Standard' });
    setNewGroupName(''); 
    setSelectedGroupIndex(-1); 
    setSelectedParamIndex(-1); 
    setSelectedRuleIndex(-1);
    setOriginalParamData(null);
    setOriginalRuleData(null);
  };


  const handleCreateTest = async () => {
    // Guards: LabAdmin and SuperAdmin can save. Staff cannot.
    if (userData?.role === 'Staff') return alert('❌ Staff members cannot save tests.');
    if (!activeLabId) return alert('Select a lab first.');
    if (!testForm.testName || !testForm.testCode) return alert('Test Name and Code are required');
    
    setSaving(true);
    try {
      const groupsToSave = testForm.groups.map((g, gi) => ({
        ...g,
        group_order: gi,
        parameters: g.parameters.map((p, pi) => ({ ...p, parameter_order: pi }))
      }));

      const labIdVal = isNaN(activeLabId) ? activeLabId : String(activeLabId);
      
      const finalData = {
        ...testForm,
        groups: groupsToSave,
        labId: labIdVal,
        isGlobal: false, // Local saves are never global
        updatedAt: serverTimestamp()
      };

      if (testForm.id && testForm.labId === labIdVal) {
        // Correct Lab ID exists: Update existing
        await setDoc(doc(db, 'tests', testForm.id), finalData, { merge: true });
      } else {
        // New test OR Overriding a GLOBAL test: Add new doc
        delete finalData.id;
        await addDoc(collection(db, 'tests'), { ...finalData, createdAt: serverTimestamp() });
      }

      setShowModal(false); 
      resetForm(); 
      fetchTests();

      // Check if we need to return to booking
      if (sourceFromUrl === 'booking') {
        toast.success("Price updated! Returning to Booking...");
        setTimeout(() => navigate('/bookings?autoOpen=true'), 1200);
      }
    } catch(e) { 
      alert('Save failed: ' + e.message); 
    }
    finally { setSaving(false); }
  };

  const handleSelectMasterParam = (p) => {
    if (selectedGroupIndex === -1) return alert('Select a group first.');
    // Check for duplicates in current group
    if (testForm.groups[selectedGroupIndex].parameters.some(param => param.code === p.code)) {
      return alert(`"${p.name}" is already in this group.`);
    }

    const newParam = {
      code: p.code || '',
      name: p.name || '',
      unit: p.unit || '',
      dataType: p.dataType || 'Quantitative',
      decimals: p.decimals || 0,
      rules: p.rules || [] // Copy master rules
    };

    setTestForm(prev => ({
      ...prev,
      groups: prev.groups.map((g, i) => i === selectedGroupIndex ? { ...g, parameters: [...g.parameters, newParam] } : g)
    }));

    setParamSearch('');
    setShowParamLibraryMenu(true);
    setTimeout(() => paramSearchInputRef.current?.focus(), 10);
  };

  // ── Group Handlers ───────────────────────────────────────────────────────
  const handleAddGroup = () => {
    if (!newGroupName.trim()) return alert('Group name required');
    setTestForm(p => ({ ...p, groups: [...p.groups, { group_name: newGroupName.trim(), collapsed: false, parameters: [] }] }));
    setSelectedGroupIndex(testForm.groups.length);
    setSelectedParamIndex(-1); setSelectedRuleIndex(-1); setNewGroupName('');
  };

  const handleDeleteGroup = (gi) => {
    if (!window.confirm(`Delete group "${testForm.groups[gi].group_name}" and all its parameters?`)) return;
    setTestForm(p => ({ ...p, groups: p.groups.filter((_,i)=>i!==gi) }));
    if (selectedGroupIndex===gi){ setSelectedGroupIndex(-1); setSelectedParamIndex(-1); setSelectedRuleIndex(-1); }
    else if (selectedGroupIndex>gi) setSelectedGroupIndex(p=>p-1);
  };

  const handleToggleCollapse = (gi) =>
    setTestForm(p => ({ ...p, groups: p.groups.map((g,i)=>i===gi?{...g,collapsed:!g.collapsed}:g) }));

  const handleUpdateGroupName = (gi, val) =>
    setTestForm(p => ({ ...p, groups: p.groups.map((g,i)=>i===gi?{...g,group_name:val}:g) }));

  // ── Param Handlers ───────────────────────────────────────────────────────
  const handleAddParameter = (gi) => {
    if (!paramInput.name) return alert('Parameter name required');
    if (paramInput.code && testForm.groups[gi].parameters.some(p=>p.code===paramInput.code))
      return alert(`Code "${paramInput.code}" already exists in this group`);
    const newParam = { ...paramInput, rules: [] };
    setTestForm(p => ({ ...p, groups: p.groups.map((g,i)=>i===gi?{...g,parameters:[...g.parameters,newParam]}:g) }));
    setSelectedGroupIndex(gi); 
    setSelectedParamIndex(-1); 
    setSelectedRuleIndex(-1);
    setParamInput({ code:'',name:'',unit:'',dataType:'Quantitative',decimals:2 });
    setOriginalParamData(null);
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

  const handleDeleteParameter = (gi, pi) => {
    if (gi === undefined || pi === undefined) return;
    setTestForm(p => ({
      ...p,
      groups: p.groups.map((g, idx) => idx !== gi ? g : {
        ...g,
        parameters: g.parameters.filter((_, pidx) => pidx !== pi)
      })
    }));
    handleClearParameter();
  };

  const handleAddRule = () => {
    if (selectedGroupIndex===-1||selectedParamIndex===-1) return alert('Select a parameter first');
    if (!ruleInput.normalRange) return alert('Normal range required');
    setTestForm(p => ({ ...p, groups: p.groups.map((g,gi)=>gi!==selectedGroupIndex?g:{...g,parameters:g.parameters.map((pm,pi)=>pi!==selectedParamIndex?pm:{...pm,rules:[...pm.rules,ruleInput]})}) }));
    setRuleInput({ gender:'Any',ageMin:0,ageMax:120,ageUnit:'Years',normalRange:'',criticalLow:'',criticalHigh:'' });
    setSelectedRuleIndex(-1);
    setOriginalRuleData(null);
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
    if (selectedGroupIndex === -1 || selectedParamIndex === -1 || ri === undefined) return;
    setTestForm(p => ({
      ...p,
      groups: p.groups.map((g, gi) => gi !== selectedGroupIndex ? g : {
        ...g,
        parameters: g.parameters.map((pm, pi) => pi !== selectedParamIndex ? pm : {
          ...pm,
          rules: pm.rules.filter((_, idx) => idx !== ri)
        })
      })
    }));
    handleClearRule();
  };

  const hasParamChanged = () => {
    if (!originalParamData) return false;
    return JSON.stringify(paramInput) !== JSON.stringify(originalParamData);
  };

  const hasRuleChanged = () => {
    if (!originalRuleData) return false;
    return JSON.stringify(ruleInput) !== JSON.stringify(originalRuleData);
  };

  const selectedParam = selectedGroupIndex>=0&&selectedParamIndex>=0
    ? testForm.groups[selectedGroupIndex]?.parameters[selectedParamIndex] : null;

  /* ─── RENDER ──────────────────────────────────────────────────────────── */
  return (
    <>
    <div className="max-w-full mx-auto w-full flex-1 flex flex-col overflow-hidden p-3 sm:p-4 text-slate-800 animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 px-1">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-brand-light rounded-xl mr-3 shadow-sm border border-brand-primary/10 transition-transform hover:scale-110">
            <FlaskConical className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold text-[#1F2937] tracking-tight leading-tight">Test Catalog</h1>
            <p className="text-[#7B8794] text-[10px] font-bold uppercase tracking-wider mt-1 opacity-70">Laboratory Diagnostic Protocol Repository</p>
          </div>
        </div>
        {canEditFull && (
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
            <button onClick={handleDownloadSampleCSV} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-[#E5E7EB] text-[#4B5563] rounded-xl text-[12px] font-bold hover:bg-[#F9FAFB] transition-all shadow-sm">
              <Download className="w-4 h-4" /> <span>Sample</span>
            </button>
            <button onClick={() => csvInputRef.current?.click()} disabled={csvImporting} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl text-[12px] font-bold hover:bg-indigo-100 transition-all shadow-sm">
              {csvImporting ? <Loader className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>} <span>Import</span>
            </button>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-[#1E2A5A] text-white rounded-xl text-[12px] font-bold tracking-wide hover:scale-[1.02] transition-all shadow-lg shadow-[#1E2A5A]/20 active:scale-95 group">
              <Plus className="w-4 h-4 text-white group-hover:rotate-90 transition-transform" /> New Test
            </button>
          </div>
        )}
      </div>

      {/* Search and Filters Header */}
      <div className="flex flex-col lg:flex-row gap-3 mb-6">
        <div className="flex-[2] relative group max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3] group-focus-within:text-[#1E2A5A] transition-colors" />
          <input type="text"
            className="w-full pl-11 pr-6 py-2.5 bg-white border border-[#E5E7EB] rounded-xl focus:ring-4 focus:ring-[#1E2A5A]/5 focus:border-[#1E2A5A]/20 transition-all font-bold text-[13px] text-[#1F2937] outline-none placeholder:text-[#98A2B3] shadow-sm"
            placeholder="Search by test name, code or category..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1 -mb-1">
          <div className="flex items-center gap-1.5 p-1 bg-white border border-[#E5E7EB] rounded-xl shadow-sm h-10 shrink-0">
            {[
              { id: 'active', label: 'Active', color: 'bg-emerald-500', count: statusCounts.Active },
              { id: 'inactive', label: 'Inactive', color: 'bg-rose-500', count: statusCounts.Inactive },
              { id: 'All', label: 'All Tests', color: 'bg-slate-400', count: statusCounts.All }
            ].map((btn) => (
              <div key={btn.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#F8FAFC] transition-all whitespace-nowrap h-full border border-transparent hover:border-[#E5E7EB]">
                <div className={`w-1.5 h-1.5 rounded-full ${btn.color}`}></div>
                <span className="text-[10px] font-black uppercase tracking-wider text-[#64748B]">{btn.label}</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 bg-white border border-[#E5E7EB] rounded-md tabular-nums text-[#1F2937]">{btn.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pr-2 -mr-2 custom-scrollbar min-h-0 bg-white rounded-xl shadow-sm border border-[#E5E7EB] relative" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {loading ? (
          <div className="py-24 text-center">
            <Loader className="w-10 h-10 animate-spin text-[#1E2A5A] mx-auto mb-5" />
            <p className="text-[11px] font-bold text-[#98A2B3] uppercase tracking-[0.3em]">Hydrating Catalog...</p>
          </div>
        ) : tests.length === 0 ? (
          <div className="py-32 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-[40px] flex items-center justify-center mx-auto mb-6 transition-transform hover:rotate-12">
              <Beaker className="w-8 h-8 text-slate-200" />
            </div>
            <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Catalog Empty</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="border-y border-slate-100">
              <tr>
                <th className="sticky top-0 z-20 bg-[#F9FAFB] px-4 py-2.5 text-left text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider">Test Name / ID</th>
                <th className="sticky top-0 z-20 bg-[#F9FAFB] px-4 py-2.5 text-center text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider">Category</th>
                <th className="sticky top-0 z-20 bg-[#F9FAFB] px-4 py-2.5 text-center text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider">Base Price</th>
                <th className="sticky top-0 z-20 bg-[#F9FAFB] px-4 py-2.5 text-center text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider">Status</th>
                <th className="sticky top-0 z-20 bg-[#F9FAFB] px-4 py-2.5 text-right text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {paginatedTests.map((test) => (
                  <tr key={test.id} className="hover:bg-slate-50/40 transition-all group relative">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-[#F3F4F6] rounded-lg text-[#1E2A5A]">
                          <Zap className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="text-[14px] font-semibold text-[#1F2937] leading-tight mb-0.5">{test.testName}</div>
                          <div className="text-[11px] font-medium text-[#7B8794] uppercase tracking-wider">{test.testCode}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center text-[12px] font-semibold text-[#4B5563]">{test.category}</td>
                    <td className="px-4 py-2.5 text-center text-[13px] font-bold text-[#1F2937] tabular-nums">₹{parseFloat(test.price||0).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-sm transition-all ${
                        test.status === 'inactive' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      }`}>
                        <div className="w-1 h-1 rounded-full bg-current opacity-80 mr-1" />
                        {test.status === 'inactive' ? 'Inactive' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {userData?.role !== 'Staff' && (test.labId === 'GLOBAL' || test.isGlobal) && (
                          <button
                            onClick={() => handleCloneTest(test)}
                            title="Clone as local lab copy"
                            className="p-2 bg-[#F3F4F6] text-[#4B5563] rounded-xl hover:bg-[#1E2A5A] hover:text-white transition-all shadow-sm group/clone"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleOpenEdit(test)} className="p-2 bg-[#F3F4F6] text-[#4B5563] rounded-xl hover:bg-[#1E2A5A] hover:text-white transition-all shadow-sm">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {(isSuperAdmin || (isLabAdmin && test.labId === activeLabId)) && (
                          <button onClick={() => handleDeleteTest(test.id)} className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        )}
      </div>

      <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4 px-2 pb-8">
        <div className="flex items-center gap-4">
          <p className="text-[13px] font-medium text-[#7B8794]">
            Showing <span className="text-[#1F2937]">{(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, filteredTests.length)}</span> of <span className="text-[#1F2937]">{filteredTests.length}</span> Records
          </p>
          <div className="h-4 w-px bg-[#E5E7EB] hidden md:block" />
          <select 
             className="bg-white border border-[#E5E7EB] px-3 py-1.5 rounded-lg text-[13px] font-semibold text-[#7B8794] outline-none cursor-pointer hover:border-[#1E2A5A] transition-all"
             value={rowsPerPage}
             onChange={e => setRowsPerPage(parseInt(e.target.value))}
           >
             <option value={5}>5 / page</option>
             <option value={10}>10 / page</option>
             <option value={20}>20 / page</option>
             <option value={50}>50 / page</option>
           </select>
        </div>

        <div className="flex items-center gap-2">
             <button 
               onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
               disabled={currentPage === 1}
               className="p-2 bg-white border border-[#E5E7EB] rounded-xl text-[#98A2B3] hover:text-[#1E2A5A] hover:border-[#1E2A5A] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
              >
               <ChevronLeft className="w-5 h-5" />
             </button>
             
             <div className="flex items-center gap-1.5">
               {[...Array(Math.ceil(filteredTests.length / rowsPerPage))].map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-9 h-9 rounded-xl text-[12px] font-semibold transition-all ${
                      currentPage === i + 1 
                        ? 'bg-[#1E2A5A] text-white shadow-lg shadow-[#1E2A5A]/20 scale-105' 
                        : 'bg-white text-[#7B8794] hover:bg-[#F3F4F6] border border-[#E5E7EB]'
                    }`}
                  >
                    {i + 1}
                  </button>
               ))}
             </div>

             <button 
               onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredTests.length / rowsPerPage), p + 1))}
               disabled={currentPage === Math.ceil(filteredTests.length / rowsPerPage) || Math.ceil(filteredTests.length / rowsPerPage) === 0}
               className="p-2 bg-white border border-[#E5E7EB] rounded-xl text-[#98A2B3] hover:text-[#1E2A5A] hover:border-[#1E2A5A] disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm active:scale-95"
              >
               <ChevronRight className="w-5 h-5" />
             </button>
        </div>
      </div>
    </div>

      {/* ══════════════════════════════ MODAL ══════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-[200] bg-[#1F2937]/80 backdrop-blur-md flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-6xl my-6 flex flex-col overflow-hidden text-left animate-in zoom-in-95 duration-200">

            {/* Modal Header */}
            <div className="flex justify-between items-center px-8 py-6 border-b border-[#E5E7EB] bg-[#F9FAFB] shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#1E2A5A] rounded-2xl shadow-lg shadow-[#1E2A5A]/20 rotate-3">
                  <FlaskConical className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#1F2937] tracking-tight">{testForm.id ? 'Edit Protocol' : 'New Configuration'}</h2>
                  <p className="text-[12px] text-[#7B8794] font-medium mt-1">{testForm.testName || 'Protocol setup definition'}</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2.5 bg-white border border-[#E5E7EB] shadow-sm hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-all text-[#98A2B3]">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 space-y-10 overflow-y-auto flex-grow max-h-[85vh] custom-scrollbar bg-white">

              {/* ── 1. Details ── */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-[11px] font-bold px-3 py-1 rounded-lg uppercase tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-sm">1. Basic schema</span>
                  <div className="h-px bg-[#E5E7EB] flex-grow" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div>
                    <Label>Test Code *</Label>
                    <Input placeholder="CBC001" value={testForm.testCode} disabled={!canEditFull} onChange={e => setTestForm({...testForm, testCode: e.target.value.toUpperCase()})} className="font-mono text-[#1E2A5A] font-bold"/>

                  </div>
                  <div className="col-span-2">
                    <Label>Test Name *</Label>
                    <Input placeholder="Full Diagnostic Name" value={testForm.testName} disabled={!canEditFull} onChange={e => setTestForm({...testForm, testName: e.target.value})}/>

                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={testForm.category} disabled={!canEditFull} onChange={e => setTestForm({...testForm, category: e.target.value})}>
                      {['Hematology','Biochemistry','Immunology','Microbiology','Serology','Histopathology','Cytology'].map(c=><option key={c}>{c}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>Sample</Label>
                    <Select value={testForm.sampleType} disabled={!canEditFull} onChange={e => setTestForm({...testForm, sampleType: e.target.value})}>
                      {['Whole Blood (EDTA)','Serum','Plasma','Urine','Stool','Sputum','CSF','Swab','Biopsy'].map(s=><option key={s}>{s}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>Methodology</Label>
                    <Select value={testForm.methodology} disabled={!canEditFull} onChange={e => setTestForm({...testForm, methodology: e.target.value})}>
                      <option value="">Select Method</option>
                      {['Automated', 'Semi-Automated', 'Manual', 'Slide Agglutination', 'ELISA', 'HPLC', 'CLIA', 'Nephelometry', 'PCR', 'Microscopy', 'Culture', 'Rapid Test', 'Other'].map(m=><option key={m}>{m}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>TAT (Hrs)</Label>
                    <Input placeholder="24 Hrs" value={testForm.tatHours} disabled={!canEditFull} onChange={e => setTestForm({...testForm, tatHours: e.target.value})}/>
                  </div>

                  <div>
                    <Label>Price (₹) *</Label>
                    <Input ref={priceInputRef} type="number" value={testForm.price} onChange={e => setTestForm({...testForm, price: parseFloat(e.target.value)})} className="text-[#1E2A5A] font-bold"/>
                  </div>
                  <div>
                    <Label>Report Layout</Label>
                    <Select value={testForm.reportLayout || 'Standard'} onChange={e => setTestForm({...testForm, reportLayout: e.target.value})}>
                      <option value="Standard">Standard (List)</option>
                      <option value="Tabular table">Tabular (Grid)</option>
                    </Select>
                  </div>
                </div>
              </section>


              {canEditFull && (
                <>

                  {/* ── 2. Parameter Groups ── */}
                  <section>
                    <div className="flex items-center gap-3 mb-6">
                      <span className="text-[11px] font-bold px-3 py-1 rounded-lg uppercase tracking-wider bg-sky-50 text-sky-600 border border-sky-100 shadow-sm">2. Parameter Groups</span>
                      <div className="h-px bg-[#E5E7EB] flex-grow" />
                    </div>
                    <div className="space-y-6">
                      <div className="flex gap-3">
                        <Input placeholder="Add logical group (e.g. CBC, Liver Profile)" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleAddGroup()}/>
                        <button onClick={handleAddGroup} className="px-6 py-2.5 bg-[#1E2A5A] text-white rounded-xl text-[12px] font-bold uppercase tracking-wide flex items-center gap-2 hover:scale-[1.02] transition-all shadow-lg shadow-[#1E2A5A]/20 active:scale-95 whitespace-nowrap">
                          <FolderPlus className="w-4 h-4 text-white" /> Add Group
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {testForm.groups.map((group, idx) => (
                          <div key={idx} onClick={() => { setSelectedGroupIndex(idx); setSelectedParamIndex(-1); }}
                            className={`px-4 py-2.5 rounded-xl border flex items-center gap-4 cursor-pointer transition-all ${selectedGroupIndex === idx ? 'bg-[#1E2A5A] border-[#1E2A5A] text-white shadow-xl shadow-[#1E2A5A]/20' : 'bg-white border-[#E5E7EB] text-[#7B8794] hover:border-[#1E2A5A] hover:bg-[#F3F4F6]'}`}>
                            <div className="flex items-center gap-3">
                              <Folder className={`w-4 h-4 ${selectedGroupIndex === idx ? 'text-white' : 'text-[#98A2B3]'}`} />
                              <span className="text-sm font-bold tracking-tight">{group.group_name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-lg ${selectedGroupIndex === idx ? 'bg-white/20 text-white' : 'bg-[#F3F4F6] text-[#7B8794]'}`}>{group.parameters.length}</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(idx); }} className={`p-1 rounded-lg transition-colors ${selectedGroupIndex === idx ? 'hover:bg-white/20 text-white' : 'hover:bg-rose-100 text-[#98A2B3] hover:text-rose-600'}`}>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* ── Parameters & Rules Grid ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* ── 3. Params ── */}
                    <section>
                      <div className="flex items-center gap-3 mb-6">
                        <span className="text-[11px] font-bold px-3 py-1 rounded-lg uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-100 shadow-sm">3. Parameters {selectedGroupIndex >= 0 && `(${testForm.groups[selectedGroupIndex].group_name})`}</span>
                        <div className="h-px bg-[#E5E7EB] flex-grow" />
                      </div>
                      {selectedGroupIndex === -1 ? (
                        <div className="py-20 text-center border border-[#E5E7EB] border-dashed rounded-3xl bg-[#F9FAFB]">
                          <Layers className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
                          <p className="text-[12px] font-semibold text-[#98A2B3] uppercase tracking-wider">Select group above to manage parameters</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                           <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl p-5 space-y-4 relative">
                              <Label>Search & Select from Master Library</Label>
                              <div className="relative group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#98A2B3] group-focus-within:text-[#1E2A5A] transition-colors" />
                                <Input 
                                  ref={paramSearchInputRef}
                                  placeholder="Type to search or click to view all..." 
                                  value={paramSearch} 
                                  onChange={e => setParamSearch(e.target.value)}
                                  onFocus={() => setShowParamLibraryMenu(true)}
                                  className="pl-10"
                                />
                                {showParamLibraryMenu && (
                                  <div className="absolute z-[300] left-0 right-0 mt-2 bg-white border border-[#E5E7EB] rounded-2xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar divide-y divide-[#F3F4F6] p-1">
                                    <div className="flex justify-between items-center p-2 px-4 bg-[#F9FAFB] rounded-t-xl mb-1 sticky top-0 z-10">
                                      <span className="text-[10px] font-bold text-[#98A2B3] uppercase tracking-widest">Parameter Library</span>
                                      <button onClick={(e) => { e.stopPropagation(); setShowParamLibraryMenu(false); }} className="p-1 hover:bg-[#E5E7EB] rounded-lg text-[#98A2B3]">
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    {masterParams
                                      .filter(p => {
                                        if (!paramSearch) return true;
                                        return p.name?.toLowerCase().includes(paramSearch.toLowerCase()) || 
                                               p.code?.toLowerCase().includes(paramSearch.toLowerCase());
                                      })
                                      .slice(0, 50).map(p => (
                                        <button key={p.id} 
                                          onMouseDown={(e) => {
                                            e.preventDefault();
                                            handleSelectMasterParam(p);
                                          }} 
                                          className="w-full text-left px-4 py-3 hover:bg-[#F3F4F6] transition-colors flex items-center justify-between group rounded-xl">
                                          <div className="flex flex-col">
                                            <span className="text-sm font-bold text-[#1F2937] group-hover:text-[#1E2A5A] transition-colors">{p.name}</span>
                                            <span className="text-[10px] text-[#98A2B3] font-bold uppercase tracking-widest">{p.code} <span className="text-[#E5E7EB] mx-1">|</span> {p.unit || 'No unit'}</span>
                                          </div>
                                          <Plus className="w-4 h-4 text-[#D1D5DB] group-hover:text-[#1E2A5A] transition-all group-active:scale-125" />
                                        </button>
                                      ))}
                                    {masterParams.length > 0 && masterParams.filter(p => !paramSearch || p.name?.toLowerCase().includes(paramSearch.toLowerCase()) || p.code?.toLowerCase().includes(paramSearch.toLowerCase())).length === 0 && (
                                      <div className="p-10 text-center text-[11px] font-bold text-[#98A2B3] uppercase tracking-wider">No match found</div>
                                    )}
                                  </div>
                                )}
                              </div>
                              <p className="text-[11px] text-[#7B8794] font-medium px-1 italic">Select from master catalog to add into this test.</p>
                           </div>

                           <div className="max-h-80 overflow-y-auto border border-[#E5E7EB] rounded-2xl divide-y divide-[#F3F4F6] bg-white shadow-sm custom-scrollbar">
                              {testForm.groups[selectedGroupIndex].parameters.map((p, pi) => (
                                <div key={pi} onClick={() => { setSelectedParamIndex(pi); setParamInput({...p}); setSelectedRuleIndex(-1); setRuleInput({ gender: 'Any', ageMin: 0, ageMax: 100, ageUnit: 'Years', normalRange: '', criticalLow: '', criticalHigh: '' }); }}
                                  className={`px-5 py-4 flex items-center justify-between cursor-pointer group transition-all ${selectedParamIndex === pi ? 'bg-[#F3F4F6] border-l-4 border-[#1E2A5A]' : 'hover:bg-[#F9FAFB]'}`}>
                                  <div>
                                    <div className="text-sm font-bold text-[#1F2937]">{p.name}</div>
                                    <div className="text-[11px] font-medium text-[#7B8794] uppercase flex items-center gap-2 mt-1">
                                      <span>{p.code}</span> <span className="text-[#E5E7EB]">|</span> <span>{p.unit || 'No unit'}</span>
                                    </div>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteParameter(selectedGroupIndex, pi); }} className="p-2 text-[#98A2B3] hover:text-rose-500 rounded-lg transition-all">
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))}
                           </div>
                        </div>
                      )}
                    </section>

                    {/* ── 4. Rules ── */}
                    <section>
                      <div className="flex items-center gap-3 mb-6">
                        <span className="text-[11px] font-bold px-3 py-1 rounded-lg uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">4. Rules {selectedParamIndex >= 0 && `(${testForm.groups[selectedGroupIndex].parameters[selectedParamIndex].name})`}</span>
                        <div className="h-px bg-[#E5E7EB] flex-grow" />
                      </div>
                      {selectedParamIndex === -1 ? (
                        <div className="py-20 text-center border border-[#E5E7EB] border-dashed rounded-3xl bg-[#F9FAFB]">
                          <Zap className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" />
                          <p className="text-[12px] font-semibold text-[#98A2B3] uppercase tracking-wider">Select parameter to manage rules</p>
                        </div>
                      ) : (
                        <div className="space-y-6">
                           <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm border-t-4 border-t-[#1E2A5A]/10 space-y-5">
                              <div className="grid grid-cols-4 gap-4">
                                <div><Label>Gender</Label><Select value={ruleInput.gender} onChange={e => setRuleInput({...ruleInput, gender: e.target.value})}><option>Any</option><option>Male</option><option>Female</option></Select></div>
                                <div><Label>Min Age</Label><Input type="number" value={ruleInput.ageMin} onChange={e => setRuleInput({...ruleInput, ageMin: parseInt(e.target.value)})}/></div>
                                <div><Label>Max Age</Label><Input type="number" value={ruleInput.ageMax} onChange={e => setRuleInput({...ruleInput, ageMax: parseInt(e.target.value)})}/></div>
                                <div><Label>Unit</Label><Select value={ruleInput.ageUnit} onChange={e => setRuleInput({...ruleInput, ageUnit: e.target.value})}><option>Years</option><option>Months</option><option>Days</option></Select></div>
                                <div className="col-span-2"><Label>Normal Range *</Label><Input placeholder="e.g. 13.5 - 17.5" value={ruleInput.normalRange} onChange={e => setRuleInput({...ruleInput, normalRange: e.target.value})} className="text-emerald-600 font-bold"/></div>
                                <div><Label>Crit Low</Label><Input placeholder="L" value={ruleInput.criticalLow} onChange={e => setRuleInput({...ruleInput, criticalLow: e.target.value})} className="text-rose-500 font-bold"/></div>
                                <div><Label>Crit High</Label><Input placeholder="H" value={ruleInput.criticalHigh} onChange={e => setRuleInput({...ruleInput, criticalHigh: e.target.value})} className="text-rose-600 font-bold"/></div>
                              </div>
                              <div className="flex gap-3">
                                {selectedRuleIndex === -1 ? (
                                  <button onClick={handleAddRule} className="flex-grow py-2.5 bg-emerald-600 text-white rounded-xl text-[12px] font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 hover:bg-emerald-700 shadow-lg shadow-emerald-100 active:scale-95">
                                    <Plus className="w-4 h-4" /> Add Rule
                                  </button>
                                ) : (
                                  <>
                                    <button onClick={handleUpdateRule} disabled={!hasRuleChanged()} className="flex-grow py-2.5 bg-[#1E2A5A] text-white rounded-xl text-[12px] font-bold uppercase tracking-wide transition-all flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50">Update Rule</button>
                                    <button onClick={handleClearRule} className="px-6 py-2.5 bg-[#F3F4F6] text-[#7B8794] rounded-xl text-[12px] font-bold uppercase hover:bg-[#E5E7EB] hover:text-[#1F2937] transition-all">Clear</button>
                                  </>
                                )}
                              </div>
                           </div>

                           <div className="max-h-56 overflow-y-auto border border-[#E5E7EB] rounded-2xl bg-white shadow-sm overflow-x-auto custom-scrollbar">
                              <table className="w-full text-left">
                                <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB] sticky top-0">
                                  <tr>
                                    <th className="px-5 py-3 text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider">Gender</th>
                                    <th className="px-5 py-3 text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider">Age Range</th>
                                    <th className="px-5 py-3 text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider">Normal Range</th>
                                    <th className="px-5 py-3 text-[10px] font-semibold text-[#98A2B3] uppercase tracking-wider text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-[#F3F4F6]">
                                  {testForm.groups[selectedGroupIndex].parameters[selectedParamIndex].rules?.map((rule, idx) => (
                                    <tr key={idx} onClick={() => { setSelectedRuleIndex(idx); setRuleInput({...rule}); }}
                                      className={`cursor-pointer transition-all ${selectedRuleIndex === idx ? 'bg-emerald-50/50 border-l-4 border-emerald-500' : 'hover:bg-[#F9FAFB]'}`}>
                                      <td className="px-5 py-3 text-[13px] font-bold text-[#1F2937]">{rule.gender}</td>
                                      <td className="px-5 py-3 text-[13px] font-medium text-[#4B5563]">{rule.ageMin}-{rule.ageMax} {rule.ageUnit}</td>
                                      <td className="px-5 py-3 text-[13px] font-bold text-emerald-600">{rule.normalRange}</td>
                                      <td className="px-5 py-3 text-right">
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteRule(idx); }} className="p-1.5 text-[#98A2B3] hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                      </td>
                                    </tr>
                                  ))}
                                  {(!testForm.groups[selectedGroupIndex].parameters[selectedParamIndex].rules?.length) && (
                                    <tr><td colSpan={4} className="p-10 text-center text-[12px] font-semibold text-[#98A2B3] uppercase tracking-wider">No rules defined for this parameter</td></tr>
                                  )}
                                </tbody>
                              </table>
                           </div>
                        </div>
                      )}
                    </section>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-5 border-t border-[#E5E7EB] bg-[#F9FAFB] flex items-center justify-between shrink-0 select-none">
              <div className="flex items-center gap-4 text-[11px] text-[#7B8794] font-bold uppercase tracking-wider">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#1E2A5A]" /> {testForm.groups?.length || 0} Parameter Groups</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setShowModal(false)} className="px-6 py-2.5 text-[12px] font-bold text-[#7B8794] uppercase hover:text-[#1F2937] transition-colors">Cancel</button>
                <button onClick={handleCreateTest} disabled={saving} className="px-10 py-2.5 bg-emerald-600 text-white rounded-xl text-[12px] font-bold uppercase tracking-wide hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100 active:scale-95 disabled:opacity-50">
                  {saving ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {testForm.id ? 'Update Test' : 'Publish Test'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Tests;
