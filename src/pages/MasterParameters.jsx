import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs, addDoc, setDoc, deleteDoc, doc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Plus, Loader, Trash2, Edit3, X, Save, FlaskConical, Search, Download, Upload } from 'lucide-react';

/* ─── Reusable UI Primitives ─────────────────────────────────────────────── */
const Label = ({ children }) => (
  <label className="block text-[11px] font-black text-slate-400 mb-1.5 uppercase tracking-[0.2em] ml-1">{children}</label>
);
const Input = ({ className = '', ...props }) => (
  <input
    className={`w-full px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-[18px] text-sm font-bold text-brand-dark outline-none focus:border-brand-primary/40 focus:ring-4 focus:ring-brand-primary/10 transition-all placeholder:text-slate-300 shadow-inner ${className}`}
    {...props}
  />
);
const Select = ({ className = '', children, ...props }) => (
  <select
    className={`w-full px-4 py-3 bg-slate-50/50 border border-slate-100 rounded-[18px] text-sm font-bold text-brand-dark outline-none focus:border-brand-primary/40 focus:ring-4 focus:ring-brand-primary/10 transition-all appearance-none cursor-pointer shadow-inner ${className}`}
    {...props}
  >
    {children}
  </select>
);

const DATA_TYPES = ['Quantitative', 'Qualitative', 'Semi-Quantitative', 'Titer'];
const EMPTY_RULE = { gender: 'Any', ageMin: 0, ageMax: 120, ageUnit: 'Years', normalRange: '', criticalLow: '', criticalHigh: '' };
const EMPTY_FORM = { code: '', name: '', unit: '', dataType: 'Quantitative', decimals: 2, allowedOptions: '', rules: [] };

const MasterParameters = () => {
  const { userData } = useAuth();
  const isSuperAdmin = userData?.role === 'SuperAdmin';

  const [parameters, setParameters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const csvInputRef = React.useRef(null);

  useEffect(() => { fetchParameters(); }, []);

  const fetchParameters = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'masterParameters'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      setParameters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      try {
        const snap = await getDocs(collection(db, 'masterParameters'));
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setParameters(items);
      } catch (e2) { console.error(e2); }
    } finally { setLoading(false); }
  };

  const filteredParams = parameters.filter(p =>
    p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.unit?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEditModal = (param) => {
    setEditingId(param.id);
    setForm({
      code: param.code || '',
      name: param.name || '',
      unit: param.unit || '',
      dataType: param.dataType || 'Quantitative',
      decimals: param.decimals ?? 2,
      allowedOptions: param.allowedOptions || '',
      rules: Array.isArray(param.rules) ? param.rules : [],
    });
    setShowModal(true);
  };

  /* ── Rule Handlers ── */
  const handleAddRule = () => {
    setForm(prev => ({ ...prev, rules: [...prev.rules, { ...EMPTY_RULE }] }));
  };
  const handleRuleChange = (idx, field, value) => {
    setForm(prev => ({
      ...prev,
      rules: prev.rules.map((r, i) => i === idx ? { ...r, [field]: value } : r)
    }));
  };
  const handleDeleteRule = (idx) => {
    setForm(prev => ({ ...prev, rules: prev.rules.filter((_, i) => i !== idx) }));
  };

  /* ── Save ── */
  const handleSave = async () => {
    if (!form.name.trim()) return alert('Parameter Name is required.');
    if (!form.code.trim()) return alert('Parameter Code is required.');
    if (!editingId) {
      const exists = parameters.some(p => p.code.toUpperCase() === form.code.toUpperCase());
      if (exists) return alert(`Code "${form.code.toUpperCase()}" already exists.`);
    }
    setSaving(true);
    try {
      const data = {
        code: form.code.toUpperCase().trim(),
        name: form.name.trim(),
        unit: form.unit.trim(),
        dataType: form.dataType,
        decimals: parseInt(form.decimals) || 0,
        allowedOptions: form.allowedOptions.trim(),
        rules: form.rules.map(r => ({
          gender: r.gender,
          ageMin: parseFloat(r.ageMin) || 0,
          ageMax: parseFloat(r.ageMax) || 120,
          ageUnit: r.ageUnit,
          normalRange: r.normalRange.trim(),
          criticalLow: r.criticalLow.trim(),
          criticalHigh: r.criticalHigh.trim(),
        })),
        updatedAt: serverTimestamp(),
      };
      if (editingId) {
        await setDoc(doc(db, 'masterParameters', editingId), data, { merge: true });
      } else {
        await addDoc(collection(db, 'masterParameters'), { ...data, createdAt: serverTimestamp() });
      }
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      await fetchParameters();
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteDoc(doc(db, 'masterParameters', id));
      setDeleteConfirm(null);
      await fetchParameters();
    } catch (e) { alert('Delete failed: ' + e.message); }
  };

  /* ── CSV Import/Download ── */
  const handleDownloadSampleCSV = () => {
    const H = ["Code", "Name", "Unit", "DataType", "Decimals", "Options", "RuleGender", "AgeMin", "AgeMax", "AgeUnit", "NormalRange", "CritLow", "CritHigh"];
    const rows = [
      H,
      ["HGB", "Hemoglobin", "g/dL", "Quantitative", "2", "", "Male", "18", "120", "Years", "13.8 - 17.2", "7.0", "20.0"],
      ["HGB", "", "", "", "", "", "Female", "18", "120", "Years", "12.1 - 15.1", "7.0", "20.0"],
      ["TLC", "Total Leucocyte Count", "/cumm", "Quantitative", "0", "", "Any", "0", "120", "Years", "4000 - 11000", "3000", "15000"],
      ["ALB", "Albumin", "g/dL", "Semi-Quantitative", "0", "+,++,+++,++++", "Any", "0", "120", "Years", "Negative", "", ""],
      ["WID_O", "S. Typhi Antigen O", "Titre", "Titer", "0", "1:20,1:40,1:80,1:160,1:320", "Any", "0", "120", "Years", "Negative / <1:80", "", ""]
    ];
    const csvContent = rows.map(r => r.map(v => {
      const s = String(v || '');
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'master_parameters_sample.csv';
    link.click();
  };

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return alert("CSV is empty");

        const parseCSVLine = (line) => {
          const result = []; let current = ''; let inQuotes = false;
          for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') { if (inQuotes && line[i+1] === '"') { current += '"'; i++; } else inQuotes = !inQuotes; }
            else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
            else current += char;
          }
          result.push(current.trim()); return result;
        };

        const paramsMap = new Map();
        for (let i = 1; i < lines.length; i++) {
          const row = parseCSVLine(lines[i]);
          const code = (row[0] || '').toUpperCase().trim();
          if (!code) continue;

          if (!paramsMap.has(code)) {
            paramsMap.set(code, {
              code,
              name: row[1] || code,
              unit: row[2] || '',
              dataType: row[3] || 'Quantitative',
              decimals: parseInt(row[4]) || 0,
              allowedOptions: row[5] || '',
              rules: []
            });
          }
          const p = paramsMap.get(code);
          if (row[10]) { // Normal Range present
            p.rules.push({
              gender: row[6] || 'Any',
              ageMin: parseFloat(row[7]) || 0,
              ageMax: parseFloat(row[8]) || 120,
              ageUnit: row[9] || 'Years',
              normalRange: row[10] || '',
              criticalLow: row[11] || '',
              criticalHigh: row[12] || ''
            });
          }
        }

        let success = 0;
        for (const [code, data] of paramsMap) {
          const docId = code.replace(/[^a-zA-Z0-9]/g, '_');
          await setDoc(doc(db, 'masterParameters', docId), {
            ...data,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp()
          }, { merge: true });
          success++;
        }
        await fetchParameters();
        alert(`Successfully imported/updated ${success} parameters.`);
      } catch (err) { alert("Import failed: " + err.message); }
      finally { setCsvImporting(false); if (csvInputRef.current) csvInputRef.current.value = ''; }
    };
    reader.readAsText(file);
  };

  const dataTypeBadge = (type) => {
    const map = {
      Quantitative: 'bg-blue-50 text-blue-600 border-blue-100',
      Qualitative: 'bg-amber-50 text-amber-600 border-amber-100',
      'Semi-Quantitative': 'bg-emerald-50 text-emerald-600 border-emerald-100',
      Titer: 'bg-purple-50 text-purple-600 border-purple-100',
    };
    return map[type] || 'bg-slate-50 text-slate-500 border-slate-100';
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Access Restricted — SuperAdmin Only</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-8 w-full max-w-7xl mx-auto animate-in fade-in duration-500">

      {/* ── PAGE HEADER ── */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 bg-white p-8 rounded-[32px] shadow-[0_20px_50px_rgb(0,0,0,0.02)] border border-slate-100">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-brand-light rounded-[22px] shadow-sm border border-brand-primary/10 transition-transform hover:rotate-6">
            <FlaskConical className="w-8 h-8 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-brand-dark tracking-tighter uppercase">Master Parameter Library</h1>
            <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">
              {parameters.length} Global Parameters Defined
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input type="file" ref={csvInputRef} onChange={handleImportCSV} accept=".csv" className="hidden" />
          <button onClick={handleDownloadSampleCSV} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all">
            <Download className="w-4 h-4" /> Sample CSV
          </button>
          <button onClick={() => csvInputRef.current?.click()} disabled={csvImporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all disabled:opacity-50">
            {csvImporting ? <Loader className="w-4 h-4 animate-spin text-brand-primary" /> : <Upload className="w-4 h-4 text-brand-primary" />}
            {csvImporting ? 'Importing...' : 'Import CSV'}
          </button>
          <button onClick={openAddModal}
            className="flex items-center gap-2.5 px-8 py-4 bg-brand-dark text-white rounded-[20px] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-brand-secondary transition-all shadow-xl shadow-brand-dark/10 active:scale-95 border border-white/10 group">
            <Plus className="w-4 h-4 text-brand-primary group-hover:rotate-90 transition-transform" />
            Add Parameter
          </button>
        </div>
      </div>

      {/* ── SEARCH ── */}
      <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
          <input type="text" placeholder="Search by name, code or unit..."
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-slate-50/50 border border-slate-100 rounded-[20px] text-sm font-bold text-brand-dark outline-none focus:border-brand-primary/30 focus:ring-4 focus:ring-brand-primary/10 transition-all placeholder:text-slate-300" />
        </div>
      </div>

      {/* ── PARAMETERS TABLE ── */}
      <div className="bg-white rounded-[32px] shadow-[0_20px_60px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center">
            <Loader className="w-10 h-10 animate-spin text-brand-primary mb-4" />
            <p className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Loading Library...</p>
          </div>
        ) : filteredParams.length === 0 ? (
          <div className="py-28 text-center">
            <FlaskConical className="w-16 h-16 text-slate-100 mx-auto mb-4" />
            <p className="text-[13px] font-black text-slate-300 uppercase tracking-widest">
              {searchTerm ? 'No parameters found' : 'Library is empty — Add your first parameter'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-brand-dark text-[11px] font-black text-white/60 uppercase tracking-[0.2em]">
                <th className="px-6 py-4 w-24">Code</th>
                <th className="px-6 py-4">Parameter Name</th>
                <th className="px-6 py-4 w-28">Unit</th>
                <th className="px-6 py-4 w-36">Data Type</th>
                <th className="px-6 py-4 w-24 text-center">Rules</th>
                <th className="px-6 py-4 w-28 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredParams.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-mono text-[12px] font-black text-brand-secondary bg-brand-secondary/5 px-2 py-1 rounded-lg border border-brand-secondary/10">{p.code}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-black text-brand-dark">{p.name}</div>
                    {p.unit && <div className="text-[11px] text-slate-400 font-bold mt-0.5">{p.unit}</div>}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-500">{p.unit || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-wider ${dataTypeBadge(p.dataType)}`}>{p.dataType}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-black px-3 py-1 rounded-full border uppercase tracking-wider ${p.rules?.length > 0 ? 'bg-brand-light text-brand-dark border-brand-primary/10' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                      {p.rules?.length || 0} Rules
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEditModal(p)}
                        className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-light rounded-xl transition-all border border-slate-100 hover:border-brand-primary/20">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteConfirm(p)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-100 hover:border-rose-200">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── ADD/EDIT MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-brand-dark/80 backdrop-blur-3xl" onClick={() => setShowModal(false)} />
          <div className="relative bg-white w-full max-w-4xl my-6 rounded-[40px] shadow-2xl overflow-hidden border border-white/20 animate-in fade-in zoom-in duration-300">

            {/* Modal Header */}
            <div className="bg-brand-dark px-10 py-7 flex justify-between items-center sticky top-0 z-10">
              <div className="flex items-center gap-4">
                <div className="bg-brand-primary p-2.5 rounded-2xl shadow-lg">
                  <FlaskConical className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white tracking-tighter uppercase">
                    {editingId ? 'Edit Parameter' : 'Add New Parameter'}
                  </h2>
                  <p className="text-[11px] font-black text-brand-primary uppercase tracking-widest">Master Library</p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)}
                className="p-2.5 bg-white/5 hover:bg-white/10 rounded-2xl text-white/50 hover:text-white transition-all border border-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-10 space-y-8 bg-white">

              {/* ── Section 1: Basic Info ── */}
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[11px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] border bg-brand-secondary/10 text-brand-secondary border-brand-secondary/20">1. Parameter Details</span>
                  <div className="h-px bg-slate-100 flex-grow" />
                </div>
                <div className="grid grid-cols-3 gap-5 mb-5">
                  <div>
                    <Label>Code *</Label>
                    <Input placeholder="HGB" value={form.code}
                      onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                      className="font-mono tracking-widest" disabled={!!editingId} />
                    {editingId && <p className="text-[10px] text-slate-400 mt-1 ml-1">Code cannot be changed</p>}
                  </div>
                  <div className="col-span-2">
                    <Label>Parameter Name *</Label>
                    <Input placeholder="e.g. Hemoglobin" value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-5">
                  <div>
                    <Label>Unit</Label>
                    <Input placeholder="g/dL" value={form.unit}
                      onChange={e => setForm({ ...form, unit: e.target.value })} />
                  </div>
                  <div>
                    <Label>Data Type</Label>
                    <Select value={form.dataType} onChange={e => setForm({ ...form, dataType: e.target.value })}>
                      {DATA_TYPES.map(t => <option key={t}>{t}</option>)}
                    </Select>
                  </div>
                  <div>
                    <Label>Precision (Decimals)</Label>
                    <Input type="number" min="0" max="4" value={form.decimals}
                      onChange={e => setForm({ ...form, decimals: parseInt(e.target.value) || 0 })} />
                  </div>
                </div>

                {form.dataType !== 'Quantitative' && (
                  <div className="mt-5">
                    <Label>Allowed Options (Comma Separated)</Label>
                    <Input placeholder={
                      form.dataType === 'Titer' ? '1:20, 1:40, 1:80, 1:160' : 
                      form.dataType === 'Semi-Quantitative' ? '+, ++, +++, ++++' : 
                      'Normal, Abnormal, Positive, Negative'
                    }
                      value={form.allowedOptions}
                      onChange={e => setForm({ ...form, allowedOptions: e.target.value })} />
                    <p className="text-[10px] font-bold mt-1.5 ml-1 text-brand-primary">
                      💡 {form.dataType} के लिए संभावित विकल्प (options) को कॉमा (,) के साथ यहाँ लिखें
                    </p>
                  </div>
                )}
              </div>

              {/* ── Section 2: Reference Ranges ── */}
              <div>
                <div className="flex items-center gap-4 mb-6">
                  <span className="text-[11px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] border bg-brand-dark text-white border-brand-dark">2. Reference Ranges</span>
                  <div className="h-px bg-slate-100 flex-grow" />
                  <button onClick={handleAddRule}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-light text-brand-dark rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-primary hover:text-white transition-all shadow-sm border border-brand-primary/10">
                    <Plus className="w-4 h-4" /> Add Rule
                  </button>
                </div>

                {form.rules.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-100 rounded-[24px] p-10 text-center">
                    <p className="text-[12px] font-black text-slate-300 uppercase tracking-widest">
                      No reference ranges defined — Click "Add Rule" to add age/gender based ranges
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-slate-100 overflow-hidden shadow-sm">
                    {/* Table Header */}
                    <div className="grid grid-cols-[100px_1fr_1fr_100px_80px] gap-0 bg-brand-dark text-[10px] font-black text-white/60 uppercase tracking-widest px-6 py-3">
                      <div>Gender</div>
                      <div>Age Range</div>
                      <div>Normal Range</div>
                      <div>Critical</div>
                      <div></div>
                    </div>
                    {form.rules.map((rule, idx) => (
                      <div key={idx} className="grid grid-cols-[100px_1fr_1fr_100px_80px] gap-0 items-center px-6 py-4 border-t border-slate-50 hover:bg-slate-50/40 transition-colors">
                        {/* Gender */}
                        <div>
                          <select value={rule.gender} onChange={e => handleRuleChange(idx, 'gender', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-brand-dark outline-none focus:border-brand-primary/40 transition-all appearance-none cursor-pointer shadow-sm">
                            <option>Any</option>
                            <option>Male</option>
                            <option>Female</option>
                          </select>
                        </div>
                        {/* Age Range */}
                        <div className="flex items-center gap-2 px-3">
                          <input type="number" value={rule.ageMin} onChange={e => handleRuleChange(idx, 'ageMin', e.target.value)}
                            className="w-16 px-2 py-2 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-brand-dark text-center outline-none focus:border-brand-primary/40 shadow-sm" />
                          <span className="text-slate-400 font-bold text-sm">—</span>
                          <input type="number" value={rule.ageMax} onChange={e => handleRuleChange(idx, 'ageMax', e.target.value)}
                            className="w-16 px-2 py-2 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-brand-dark text-center outline-none focus:border-brand-primary/40 shadow-sm" />
                          <select value={rule.ageUnit} onChange={e => handleRuleChange(idx, 'ageUnit', e.target.value)}
                            className="px-2 py-2 bg-white border border-slate-200 rounded-xl text-[12px] font-bold text-brand-dark outline-none focus:border-brand-primary/40 appearance-none cursor-pointer shadow-sm">
                            <option>Years</option>
                            <option>Months</option>
                            <option>Days</option>
                          </select>
                        </div>
                        {/* Normal Range */}
                        <div className="px-3">
                          <input type="text" placeholder="e.g. 13.0 - 17.0" value={rule.normalRange}
                            onChange={e => handleRuleChange(idx, 'normalRange', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-brand-primary/20 rounded-xl text-[12px] font-bold text-brand-primary text-center outline-none focus:border-brand-primary/40 shadow-sm" />
                        </div>
                        {/* Critical */}
                        <div className="flex gap-1 px-1">
                          <input type="text" placeholder="Low" value={rule.criticalLow}
                            onChange={e => handleRuleChange(idx, 'criticalLow', e.target.value)}
                            className="w-full px-2 py-2 bg-white border border-rose-100 rounded-xl text-[11px] font-bold text-rose-500 text-center outline-none focus:border-rose-300 shadow-sm" />
                          <input type="text" placeholder="High" value={rule.criticalHigh}
                            onChange={e => handleRuleChange(idx, 'criticalHigh', e.target.value)}
                            className="w-full px-2 py-2 bg-white border border-rose-200 rounded-xl text-[11px] font-bold text-rose-700 text-center outline-none focus:border-rose-300 shadow-sm" />
                        </div>
                        {/* Delete Rule */}
                        <div className="flex justify-center">
                          <button onClick={() => handleDeleteRule(idx)}
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-4 sticky bottom-0">
              <button onClick={() => setShowModal(false)}
                className="px-6 py-3 rounded-2xl bg-white text-slate-400 text-[11px] font-black uppercase tracking-widest hover:text-brand-dark transition-all border border-slate-200">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-10 py-3 rounded-2xl bg-brand-primary text-white text-[11px] font-black uppercase tracking-[0.2em] hover:shadow-lg hover:shadow-brand-primary/30 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95">
                {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? 'Update Parameter' : 'Save Parameter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-brand-dark/80 backdrop-blur-3xl" onClick={() => setDeleteConfirm(null)} />
          <div className="relative bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-rose-50 px-8 py-6 border-b border-rose-100 flex items-center gap-4">
              <div className="p-3 bg-rose-100 rounded-2xl text-rose-600"><Trash2 className="w-6 h-6" /></div>
              <div>
                <h3 className="text-lg font-black text-rose-600 uppercase">Delete Parameter</h3>
                <p className="text-[11px] font-bold text-rose-400/80 uppercase tracking-widest">{deleteConfirm.code} — {deleteConfirm.name}</p>
              </div>
            </div>
            <div className="px-8 py-6">
              <p className="text-sm font-bold text-slate-500">
                यह <span className="font-black text-brand-dark">{deleteConfirm.name}</span> को Master Library से हटा देगा।
              </p>
              <p className="text-[11px] text-amber-600 font-bold mt-3 bg-amber-50 border border-amber-100 rounded-xl p-3">
                ⚠️ इस Parameter का उपयोग करने वाले existing Tests प्रभावित नहीं होंगे।
              </p>
            </div>
            <div className="px-8 pb-8 flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 rounded-2xl bg-slate-50 text-slate-500 text-[11px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-100 transition-all">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm.id)}
                className="flex-1 py-3 rounded-2xl bg-rose-500 text-white text-[11px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all active:scale-95">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterParameters;
