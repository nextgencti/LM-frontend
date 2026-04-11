import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { 
    Activity, Plus, Globe, FileText, CheckCircle, ArrowRight, 
    Loader, Mail, Phone, MapPin, Building2, User, 
    ShieldCheck, Sparkles, BarChart3, Zap, AlertCircle
} from 'lucide-react';

const Signup = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('basic');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState({
        labName: '',
        labFullName: '',
        labType: 'Standalone',
        ownerName: '',
        email: '',
        phone: '',
        licenseNo: '',
        address: '',
        city: '',
        state: '',
        pincode: ''
    });

    // Validation State
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});

    // Real-time validation
    useEffect(() => {
        const newErrors = {};
        
        // Email Validation
        if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid business email';
        }

        // Phone Validation (10 digits)
        if (formData.phone && !/^\d{10}$/.test(formData.phone.replace(/[^0-9]/g, ''))) {
            newErrors.phone = 'Please enter a valid 10-digit mobile number';
        }

        // Required fields check for current tab
        if (activeTab === 'basic') {
            if (!formData.labName) newErrors.labName = 'Short name is required';
            if (!formData.labFullName) newErrors.labFullName = 'Full laboratory name is required';
        } else if (activeTab === 'admin') {
            if (!formData.ownerName) newErrors.ownerName = 'Admin name is required';
            if (!formData.email) newErrors.email = 'Email is required';
            if (!formData.phone) newErrors.phone = 'Mobile number is required';
        } else if (activeTab === 'location') {
            if (!formData.address) newErrors.address = 'Facility address is required';
        }

        setErrors(newErrors);
    }, [formData, activeTab]);

    const handleBlur = (field) => {
        setTouched(prev => ({ ...prev, [field]: true }));
    };

    const canMoveForward = () => {
        if (activeTab === 'basic') return formData.labName && formData.labFullName && !errors.labName && !errors.labFullName;
        if (activeTab === 'admin') return formData.ownerName && formData.email && formData.phone && !errors.email && !errors.phone;
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Final validation check
        if (Object.keys(errors).length > 0) {
            alert("Please fix the errors before submitting.");
            return;
        }

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'signupRequests'), {
                ...formData,
                status: 'pending',
                createdAt: serverTimestamp()
            });
            setSuccess(true);
        } catch (error) {
            console.error("Error submitting signup request:", error);
            alert("Submission failed. Please check your connection.");
        } finally {
            setSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-brand-dark p-6 overflow-hidden relative">
                <div className="absolute inset-0 pattern-grid opacity-20"></div>
                <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-brand-primary/10 rounded-full blur-[120px]"></div>
                
                <div className="bg-white rounded-[4rem] shadow-2xl max-w-2xl w-full p-16 text-center animate-in zoom-in duration-700 relative z-10 border border-white/20">
                    <div className="w-24 h-24 bg-brand-light rounded-[32px] flex items-center justify-center mx-auto mb-8 text-brand-primary rotate-6 animate-bounce">
                        <CheckCircle className="w-12 h-12" />
                    </div>
                    <h2 className="text-4xl font-black text-brand-dark tracking-tighter uppercase mb-4">You're on the list!</h2>
                    <p className="text-slate-500 font-bold mb-10 leading-relaxed text-lg text-balance">
                        Registration request received for <span className="text-brand-dark underline decoration-brand-primary decoration-4">{formData.labFullName}</span>. 
                        We'll verify your details and email you within 24 hours.
                    </p>
                    <div className="space-y-4">
                        <button 
                            onClick={() => navigate('/')}
                            className="w-full py-5 bg-black text-white rounded-[24px] font-black uppercase text-xs tracking-[0.3em] shadow-2xl hover:bg-brand-secondary transition-all transform hover:scale-105 active:scale-95"
                        >
                            Back to Home
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const ProgressDot = ({ step, label }) => (
        <div className="flex flex-col items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-lg ${
                activeTab === step ? 'bg-brand-dark text-white scale-110' : 
                (touched[step] || canMoveForward()) ? 'bg-brand-primary text-brand-dark' : 'bg-slate-200 text-slate-400'
            }`}>
                {step === 'basic' ? <Building2 className="w-5 h-5" /> : 
                 step === 'admin' ? <User className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === step ? 'text-brand-dark' : 'text-slate-300'}`}>
                {label}
            </span>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans relative overflow-x-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 pattern-grid pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[100px] -mr-64 -mt-64"></div>
            
            <div className="relative z-10 flex min-h-screen">
                {/* Left Side: Sidebar (Desktop Only) */}
                <div className="hidden lg:flex w-[40%] bg-brand-dark p-20 flex-col justify-between relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-dark via-brand-dark to-brand-secondary/20"></div>
                    <div className="relative z-10">
                        <Link to="/" className="inline-flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-4 rounded-3xl backdrop-blur-md mb-20 hover:bg-white/10 transition-all">
                            <Activity className="w-8 h-8 text-brand-primary" />
                            <span className="text-xl font-black text-white tracking-tighter uppercase">Lab <span className="text-brand-primary">Mitra</span></span>
                        </Link>
                        
                        <div className="space-y-12">
                            <h2 className="text-5xl font-black text-white leading-[1.1] tracking-tighter">
                                Transform Your Lab into a <span className="text-brand-light">Digital Powerhouse.</span>
                            </h2>
                            
                            <div className="space-y-8">
                                {[
                                    { icon: Zap, text: "Automated Clinical Workflows", color: "text-amber-400" },
                                    { icon: BarChart3, text: "Real-time Business Analytics", color: "text-brand-primary" },
                                    { icon: ShieldCheck, text: "NABL Compliant Security", color: "text-blue-400" }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-6 group">
                                        <div className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-white/10 transition-all ${item.color}`}>
                                            <item.icon className="w-6 h-6" />
                                        </div>
                                        <span className="text-lg font-bold text-slate-300">{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 p-6 bg-white/5 rounded-3xl border border-white/10">
                            <div className="flex -space-x-4">
                                {[1,2,3].map(i => <div key={i} className="w-10 h-10 rounded-full border-2 border-brand-dark bg-slate-400"></div>)}
                            </div>
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Joined by 500+ Labs this month</span>
                        </div>
                    </div>
                </div>

                {/* Right Side: Form Content */}
                <div className="flex-1 p-8 md:p-12 lg:p-24 overflow-y-auto">
                    <div className="max-w-xl mx-auto">
                        {/* Header Mobile */}
                        <div className="lg:hidden flex justify-between items-center mb-12">
                            <div className="flex items-center gap-3">
                                <Activity className="w-8 h-8 text-brand-primary" />
                                <span className="text-xl font-black text-brand-dark tracking-tighter uppercase">Lab Mitra</span>
                            </div>
                            <Link to="/login" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-dark">Login</Link>
                        </div>

                        {/* Registration Flow Header */}
                        <div className="mb-16">
                            <h1 className="text-4xl font-black text-brand-dark tracking-tighter uppercase mb-4">Laboratory <span className="text-brand-primary">Onboarding</span></h1>
                            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]">Step {activeTab === 'basic' ? '1' : activeTab === 'admin' ? '2' : '3'} of 3</p>
                        </div>

                        {/* Progress Tracker */}
                        <div className="flex justify-between items-center mb-16 relative">
                            <div className="absolute top-6 left-0 right-0 h-[2px] bg-slate-100 -z-10">
                                <div className={`h-full bg-brand-primary transition-all duration-700 shadow-[0_0_15px_rgba(155,207,131,0.5)]`} style={{
                                    width: activeTab === 'basic' ? '0%' : activeTab === 'admin' ? '50%' : '100%'
                                }}></div>
                            </div>
                            <ProgressDot step="basic" label="Facility" />
                            <ProgressDot step="admin" label="Identity" />
                            <ProgressDot step="location" label="Location" />
                        </div>

                        {/* Registration Form */}
                        <form onSubmit={handleSubmit} className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {activeTab === 'basic' && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-2">
                                            <Label>Lab Short Name *</Label>
                                            <Input 
                                                required
                                                value={formData.labName} 
                                                onChange={(e) => setFormData({...formData, labName: e.target.value})}
                                                onBlur={() => handleBlur('labName')}
                                                error={touched.labName && errors.labName}
                                                placeholder="e.g. SKYLAB"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Lab Classification</Label>
                                            <Select 
                                                value={formData.labType} 
                                                onChange={(e) => setFormData({...formData, labType: e.target.value})}
                                            >
                                                <option>Standalone</option>
                                                <option>Hospital-Based</option>
                                                <option>Collection Center</option>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Full Laboratory Name *</Label>
                                        <Input 
                                            required
                                            value={formData.labFullName} 
                                            onChange={(e) => setFormData({...formData, labFullName: e.target.value})}
                                            onBlur={() => handleBlur('labFullName')}
                                            error={touched.labFullName && errors.labFullName}
                                            placeholder="NextGen Diagnostic & Research Centre"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>License / Registration No.</Label>
                                        <Input 
                                            value={formData.licenseNo} 
                                            onChange={(e) => setFormData({...formData, licenseNo: e.target.value})}
                                            placeholder="NABL / State Reg No."
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'admin' && (
                                <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                                    <div className="space-y-2">
                                        <Label>Primary Admin Name *</Label>
                                        <Input 
                                            required
                                            value={formData.ownerName} 
                                            onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
                                            onBlur={() => handleBlur('ownerName')}
                                            error={touched.ownerName && errors.ownerName}
                                            placeholder="Full Name of Director/Admin"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Official Business Email *</Label>
                                        <div className="relative group">
                                            <Input 
                                                required
                                                type="email"
                                                icon={<Mail className="w-4 h-4" />}
                                                value={formData.email} 
                                                onChange={(e) => setFormData({...formData, email: e.target.value})}
                                                onBlur={() => handleBlur('email')}
                                                error={touched.email && errors.email}
                                                placeholder="admin@yourlab.com"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Contact phone *</Label>
                                        <Input 
                                            required
                                            type="tel"
                                            icon={<Phone className="w-4 h-4" />}
                                            value={formData.phone} 
                                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                            onBlur={() => handleBlur('phone')}
                                            error={touched.phone && errors.phone}
                                            placeholder="10-digit mobile number"
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'location' && (
                                <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                                    <div className="space-y-2">
                                        <Label>Full Facility Address *</Label>
                                        <textarea 
                                            required
                                            rows={3}
                                            value={formData.address} 
                                            onChange={(e) => setFormData({...formData, address: e.target.value})}
                                            onBlur={() => handleBlur('address')}
                                            className={`w-full px-8 py-5 bg-white border rounded-[28px] text-sm font-black text-brand-dark outline-none transition-all resize-none shadow-sm ${
                                                touched.address && errors.address ? 'border-rose-300 ring-4 ring-rose-50' : 'border-slate-100 focus:border-brand-primary placeholder:text-slate-300'
                                            }`}
                                            placeholder="Plot No., Building Name, Area..."
                                        />
                                        {touched.address && errors.address && <p className="text-[9px] font-black text-rose-500 ml-4 uppercase tracking-widest">{errors.address}</p>}
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <Label>City</Label>
                                            <Input value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>State</Label>
                                            <Input value={formData.state} onChange={(e) => setFormData({...formData, state: e.target.value})} />
                                        </div>
                                        <div className="col-span-2 md:col-span-1 space-y-2">
                                            <Label>Pincode</Label>
                                            <Input value={formData.pincode} onChange={(e) => setFormData({...formData, pincode: e.target.value})} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="pt-12 flex flex-col md:flex-row gap-6">
                                {activeTab !== 'basic' && (
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            if (activeTab === 'location') setActiveTab('admin');
                                            else if (activeTab === 'admin') setActiveTab('basic');
                                        }}
                                        className="flex-1 py-5 bg-white border-2 border-slate-100 text-slate-400 rounded-3xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all hover:border-slate-200"
                                    >
                                        Previous Step
                                    </button>
                                )}
                                
                                {activeTab !== 'location' ? (
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            if (canMoveForward()) {
                                                if (activeTab === 'basic') setActiveTab('admin');
                                                else if (activeTab === 'admin') setActiveTab('location');
                                            } else {
                                                // Mark all current tab fields as touched
                                                const currentFields = activeTab === 'basic' ? ['labName', 'labFullName'] : ['ownerName', 'email', 'phone'];
                                                const newTouched = {...touched};
                                                currentFields.forEach(f => newTouched[f] = true);
                                                setTouched(newTouched);
                                            }
                                        }}
                                        className={`flex-[2] py-5 rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] transition-all flex items-center justify-center gap-3 shadow-xl ${
                                            canMoveForward() ? 'bg-brand-dark text-white hover:bg-black shadow-brand-dark/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                    >
                                        Continue <ArrowRight className="w-4 h-4 text-brand-primary" />
                                    </button>
                                ) : (
                                    <button 
                                        type="submit"
                                        disabled={submitting || Object.keys(errors).length > 0}
                                        className={`flex-[2] py-5 bg-brand-primary text-brand-dark rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] shadow-xl shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 ${
                                            (submitting || Object.keys(errors).length > 0) ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                    >
                                        {submitting ? <Loader className="w-5 h-5 animate-spin" /> : (
                                            <>Register My Laboratory <Sparkles className="w-5 h-5" /></>
                                        )}
                                    </button>
                                )}
                            </div>
                        </form>

                        <div className="mt-20 text-center opacity-40">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] leading-loose">
                                Security Protocol Active: 256-bit AES Encryption <br/>
                                © 2026 Lab Mitra Cloud v4.2
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ─── Signup UI Primitives ─────────────────────────────────────────────── */
const Label = ({ children }) => (
    <label className="block text-[10px] font-black text-slate-400 mb-3 uppercase tracking-[0.2em] ml-2">{children}</label>
);

const Input = ({ className = '', error, icon, ...props }) => (
    <div className="space-y-1.5">
        <div className="relative group">
            {icon && <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-primary transition-colors">{icon}</div>}
            <input
                className={`w-full ${icon ? 'pl-14' : 'px-8'} py-5 bg-white border rounded-[28px] text-sm font-black text-brand-dark outline-none transition-all shadow-sm ${
                    error ? 'border-rose-300 ring-4 ring-rose-300/10' : 'border-slate-100 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 placeholder:text-slate-300'
                } ${className}`}
                {...props}
            />
        </div>
        {error && <div className="flex items-center gap-1.5 ml-4 text-rose-500">
            <AlertCircle className="w-3 h-3" />
            <span className="text-[9px] font-black underline decoration-rose-300/30 uppercase tracking-widest">{error}</span>
        </div>}
    </div>
);

const Select = ({ className = '', children, ...props }) => (
    <div className="relative group">
        <select
            className={`w-full px-8 py-5 bg-white border border-slate-100 rounded-[28px] text-sm font-black text-brand-dark outline-none focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 transition-all appearance-none cursor-pointer shadow-sm ${className}`}
            {...props}
        >
            {children}
        </select>
        <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300 group-hover:text-brand-primary transition-colors">
            <Plus className="w-5 h-5 opacity-40" />
        </div>
    </div>
);

export default Signup;
