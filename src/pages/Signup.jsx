import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PreLoader from '../components/PreLoader';
import { 
    Activity, Plus, Globe, FileText, CheckCircle, ArrowRight, ArrowLeft, LogIn,
    Loader, Mail, Phone, MapPin, Building2, User, 
    ShieldCheck, Sparkles, BarChart3, Zap, AlertCircle, CreditCard
} from 'lucide-react';
import { toast } from 'react-toastify';

const Signup = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('basic');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const { currentUser, loading: authLoading } = useAuth();

    useEffect(() => {
        if (!authLoading && currentUser) {
            navigate('/dashboard');
        }
    }, [currentUser, authLoading, navigate]);
    
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
        pincode: '',
        plan: 'basic'
    });

    // Validation State
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [plans, setPlans] = useState({});
    const [loadingPlans, setLoadingPlans] = useState(true);

    // Verification State
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);
    const [emailVerified, setEmailVerified] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [otpCooldown, setOtpCooldown] = useState(0);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        let timer;
        if (otpCooldown > 0) {
            timer = setInterval(() => {
                setOtpCooldown(prev => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [otpCooldown]);

    const handleSendOtp = async () => {
        if (!formData.email || errors.email) {
            setTouched(prev => ({ ...prev, email: true }));
            return;
        }

        setSendingOtp(true);
        try {
            const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

            // 1. Check Email Availability First
            const checkRes = await fetch(`${BACKEND_URL}/api/auth/check-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email })
            });

            const checkData = await checkRes.json();
            if (!checkRes.ok || !checkData.available) {
                toast.error(checkData.message || "This email cannot be used for registration.");
                setSendingOtp(false);
                return;
            }

            // 2. Proceed with OTP if available
            const response = await fetch(`${BACKEND_URL}/api/auth/send-signup-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    email: formData.email,
                    labName: formData.labFullName || formData.labName || 'Lab Mitra'
                })
            });
            const data = await response.json();
            if (response.ok) {
                setOtpSent(true);
                setOtpCooldown(60);
                toast.success("OTP sent to your email!");
            } else {
                toast.error(data.error || "Failed to send OTP");
            }
        } catch (error) {
            console.error("OTP Error:", error);
            toast.error("Connection error. Could not send OTP.");
        } finally {
            setSendingOtp(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp) return;
        setVerifyingOtp(true);
        try {
            const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
            const response = await fetch(`${BACKEND_URL}/api/auth/verify-signup-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: formData.email, otp })
            });
            const data = await response.json();
            if (response.ok) {
                setEmailVerified(true);
                toast.success("Email verified successfully!");
            } else {
                toast.error(data.error || "Invalid OTP");
            }
        } catch (error) {
            console.error("Verification Error:", error);
            toast.error("Connection error. Could not verify OTP.");
        } finally {
            setVerifyingOtp(false);
        }
    };

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'plans'), (snapshot) => {
            const plansData = {};
            snapshot.docs.forEach(doc => {
                plansData[doc.id] = doc.data();
            });
            setPlans(plansData);
            setLoadingPlans(false);
        });
        return () => unsubscribe();
    }, []);

    const formatPrice = (priceStr) => {
        if (!priceStr) return '0';
        return priceStr; // Already formatted in DB
    };

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
        if (activeTab === 'admin') return formData.ownerName && formData.email && formData.phone && !errors.email && !errors.phone && emailVerified;
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Safety: Only allow submission on the final plan tab
        if (activeTab !== 'plan') return;
        
        // Final validation check
        if (Object.keys(errors).length > 0) {
            toast.warn("Please fix the errors before submitting.");
            return;
        }

        setSubmitting(true);
        try {
            await addDoc(collection(db, 'signupRequests'), {
                ...formData,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            // Notify Super Admin 24/7 via Email Alert
            try {
                const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
                await fetch(`${BACKEND_URL}/api/signup/notify-admin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        labName: formData.labFullName || formData.labName,
                        ownerName: formData.ownerName,
                        email: formData.email,
                        phone: formData.phone,
                        plan: formData.plan
                    })
                });
            } catch (err) {
                console.warn("[Admin Notification] Failed to notify super admins:", err.message);
                // We don't block the user success if notification fails
            }

            setSuccess(true);
            toast.success("Application submitted successfully!");
        } catch (error) {
            console.error("Error submitting signup request:", error);
            toast.error("Submission failed. Please check your connection.");
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
                 step === 'admin' ? <User className="w-5 h-5" /> : 
                 step === 'location' ? <MapPin className="w-5 h-5" /> : 
                 <CreditCard className="w-5 h-5" />}
            </div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${activeTab === step ? 'text-brand-dark' : 'text-slate-300'}`}>
                {label}
            </span>
        </div>
    );

    return (
        <div className="h-screen bg-slate-50 font-sans relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 pattern-grid pointer-events-none"></div>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[100px] -mr-64 -mt-64"></div>
            
            <div className="relative z-10 flex h-full">
                {/* Left Side: Sidebar (Desktop Only) */}
                <div className="hidden lg:flex w-[40%] bg-brand-dark p-10 flex-col justify-between relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-dark via-brand-dark to-brand-secondary/20 opacity-50"></div>
                    
                    {/* Floating Glows */}
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-primary/10 rounded-full blur-[120px] animate-pulse"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-secondary/10 rounded-full blur-[120px]"></div>

                    <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-8">
                            <Link to="/" className="inline-flex items-center gap-3 bg-white/5 border border-white/10 px-5 py-3 rounded-2xl backdrop-blur-md hover:bg-white/10 transition-all transition-transform hover:scale-105 active:scale-95">
                                <div className="w-8 h-8 bg-white rounded-lg shadow-md border border-slate-100 overflow-hidden flex items-center justify-center p-1">
                                    <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
                                </div>
                                <span className="text-lg font-black text-white tracking-tighter uppercase font-sans">Lab <span className="text-brand-primary">Mitra</span></span>
                            </Link>

                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={() => navigate('/')} 
                                    className="hidden sm:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-colors group"
                                >
                                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                                    Back
                                </button>
                                <Link 
                                    to="/login" 
                                    className="flex items-center gap-2 bg-brand-primary/10 border border-brand-primary/20 px-5 py-2.5 rounded-xl text-brand-primary text-[10px] font-black uppercase tracking-widest hover:bg-brand-primary hover:text-brand-dark transition-all hover:scale-105 active:scale-95"
                                >
                                    <LogIn className="w-4 h-4" />
                                    Login
                                </Link>
                            </div>
                        </div>
                        
                        <div className="flex-grow flex flex-col gap-8">
                            <h2 className="text-4xl font-black text-white leading-tight tracking-tighter max-w-sm">
                                The Future of <span className="text-brand-primary italic">Clinical</span> Diagnostic Infrastructure.
                            </h2>

                            {/* PORTRAIT PREMIUM CARD */}
                            <div className="relative flex-grow max-h-[500px] min-h-[400px] group animate-float">
                                <div className="absolute inset-0 bg-brand-primary/20 blur-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-1000"></div>
                                <div className="relative h-full w-full rounded-[40px] overflow-hidden border border-white/10 shadow-2xl transition-transform duration-700 group-hover:scale-[1.02]">
                                    <img 
                                        src="/signup-portrait.png" 
                                        alt="Professional Scientist" 
                                        className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 transition-all duration-1000 scale-110 group-hover:scale-100" 
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-brand-dark via-brand-dark/20 to-transparent"></div>
                                    
                                    {/* Glass Overlay Badges */}
                                    <div className="absolute bottom-8 left-8 right-8 space-y-4">
                                        <div className="glass-card-dark p-4 rounded-2xl border border-white/5 backdrop-blur-md">
                                            <div className="flex items-center gap-4 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-brand-primary animate-ping"></div>
                                                <span className="text-[10px] font-black text-brand-primary uppercase tracking-[0.2em]">Live Diagnostics</span>
                                            </div>
                                            <p className="text-sm font-bold text-white/90 leading-snug">Precision synchronized across your entire clinical workflow.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4 mt-auto">
                                {[
                                    { icon: Zap, text: "Automated Clinical Workflows", sub: "End-to-end automation", color: "text-amber-400" },
                                    { icon: BarChart3, text: "Business Intelligence Sync", sub: "Real-time branch analytics", color: "text-brand-primary" }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-5 p-4 rounded-3xl hover:bg-white/5 transition-all group/item">
                                        <div className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover/item:scale-110 transition-all ${item.color}`}>
                                            <item.icon className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-white uppercase tracking-tight">{item.text}</h4>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.sub}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                             <div className="flex items-center gap-4 border border-white/10 p-4 rounded-2xl bg-white/5 backdrop-blur-sm">
                                <div className="flex -space-x-3">
                                    {[1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-brand-dark bg-slate-500 flex items-center justify-center overflow-hidden italic text-[8px] font-black text-white uppercase tracking-tighter">LM</div>)}
                                </div>
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Joined by <br/><span className="text-white">500+ Labs</span></span>
                             </div>
                             <ShieldCheck className="w-8 h-8 text-white/10 hover:text-brand-primary transition-colors" />
                        </div>
                    </div>
                </div>

                {/* Right Side: Form Content */}
                <div className="flex-1 flex flex-col min-w-0 bg-slate-50 relative">
                    {/* FIXED HEADER SECTION */}
                    <div className="p-6 md:p-10 lg:p-16 pb-0 md:pb-0 lg:pb-0 relative z-20 bg-slate-50/80 backdrop-blur-md">
                        <div className="max-w-xl mx-auto">
                            {/* Header Mobile */}
                            <div className="lg:hidden flex justify-between items-center mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden flex items-center justify-center p-1">
                                        <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
                                    </div>
                                    <span className="text-xl font-black text-brand-dark tracking-tighter uppercase">Lab <span className="text-brand-primary">Mitra</span></span>
                                </div>
                                <Link to="/login" className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-brand-dark">Login</Link>
                            </div>

                            {/* Registration Flow Header */}
                            <div className="mb-8">
                                <h1 className="text-3xl font-black text-brand-dark tracking-tighter uppercase mb-2">Laboratory <span className="text-brand-primary">Onboarding</span></h1>
                                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]">Step {activeTab === 'basic' ? '1' : activeTab === 'admin' ? '2' : activeTab === 'location' ? '3' : '4'} of 4</p>
                            </div>

                            {/* Progress Tracker */}
                            <div className="flex justify-between items-center mb-6 relative">
                                <div className="absolute top-6 left-0 right-0 h-[2px] bg-slate-100 -z-10">
                                    <div className={`h-full bg-brand-primary transition-all duration-700 shadow-[0_0_15px_rgba(155,207,131,0.5)]`} style={{
                                        width: activeTab === 'basic' ? '0%' : activeTab === 'admin' ? '33.33%' : activeTab === 'location' ? '66.66%' : '100%'
                                    }}></div>
                                </div>
                                <ProgressDot step="basic" label="Facility" />
                                <ProgressDot step="admin" label="Identity" />
                                <ProgressDot step="location" label="Location" />
                                <ProgressDot step="plan" label="Plan" />
                            </div>
                        </div>
                        {/* Shadow/Line to indicate scroll boundary */}
                        <div className="h-px bg-slate-200 mt-4 max-w-xl mx-auto opacity-50"></div>
                    </div>

                    {/* SCROLLABLE BODY SECTION */}
                    <div className="flex-1 p-6 md:p-10 lg:p-16 pt-8 md:pt-10 lg:pt-12 overflow-y-auto custom-scrollbar relative z-10">
                        <div className="max-w-xl mx-auto">
                            {/* Registration Form */}
                            <form onSubmit={handleSubmit} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
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
                                                onChange={(e) => {
                                                    setFormData({...formData, email: e.target.value});
                                                    setEmailVerified(false);
                                                    setOtpSent(false);
                                                }}
                                                onBlur={() => handleBlur('email')}
                                                error={touched.email && errors.email}
                                                disabled={emailVerified}
                                                placeholder="admin@yourlab.com"
                                            />
                                            {!emailVerified && formData.email && !errors.email && (
                                                <button 
                                                    type="button"
                                                    onClick={handleSendOtp}
                                                    disabled={sendingOtp || otpCooldown > 0}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-brand-dark text-white text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-black transition-all disabled:opacity-50"
                                                >
                                                    {sendingOtp ? 'Sending...' : otpCooldown > 0 ? `Retry in ${otpCooldown}s` : otpSent ? 'Resend OTP' : 'Verify Email'}
                                                </button>
                                            )}
                                            {emailVerified && (
                                                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2 text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-full border border-brand-primary/20">
                                                    <CheckCircle className="w-3.5 h-3.5" />
                                                    <span className="text-[9px] font-black uppercase tracking-widest">Verified</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {otpSent && !emailVerified && (
                                        <div className="space-y-2 animate-in slide-in-from-top-4 duration-500">
                                            <Label>Verification Code (OTP) *</Label>
                                            <div className="flex gap-4">
                                                <div className="flex-1">
                                                    <Input 
                                                        value={otp}
                                                        onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                                        placeholder="Enter 6-digit code"
                                                        className="text-center tracking-[0.4em] text-lg"
                                                    />
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={handleVerifyOtp}
                                                    disabled={verifyingOtp || otp.length !== 6}
                                                    className={`px-8 py-5 rounded-[28px] font-black uppercase text-[10px] tracking-widest transition-all ${
                                                        otp.length === 6 ? 'bg-brand-primary text-brand-dark hover:scale-105 active:scale-95 shadow-lg shadow-brand-primary/20' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                                                    }`}
                                                >
                                                    {verifyingOtp ? <Loader className="w-4 h-4 animate-spin" /> : 'Confirm'}
                                                </button>
                                            </div>
                                            <p className="text-[9px] font-black text-slate-400 ml-4 uppercase tracking-widest">
                                                Check your inbox for the verification code sent to {formData.email}.
                                            </p>
                                        </div>
                                    )}
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

                            {activeTab === 'plan' && (
                                <div className="space-y-10 animate-in slide-in-from-right-4 duration-500">
                                    {loadingPlans ? (
                                        <div className="py-20 flex flex-col items-center justify-center bg-white rounded-[40px] shadow-sm border border-slate-100">
                                            <Loader className="w-10 h-10 animate-spin text-brand-primary mb-4" />
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fetching Latest Plans...</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {/* Basic Plan Card */}
                                            {plans.basic && (
                                                <button 
                                                    type="button"
                                                    onClick={() => setFormData({...formData, plan: 'basic'})}
                                                    className={`relative p-8 rounded-[40px] text-left transition-all border-2 flex flex-col h-full ${
                                                        formData.plan === 'basic' 
                                                        ? 'bg-white border-brand-primary shadow-2xl shadow-brand-primary/10 ring-4 ring-brand-primary/5' 
                                                        : 'bg-slate-50 border-transparent hover:bg-white hover:border-slate-200 grayscale opacity-60'
                                                    }`}
                                                >
                                                    <div className="mb-6 flex justify-between items-start">
                                                        <div className={`p-3 rounded-2xl ${formData.plan === 'basic' ? 'bg-brand-primary/10 text-brand-primary' : 'bg-slate-200 text-slate-400'}`}>
                                                            <ShieldCheck className="w-6 h-6" />
                                                        </div>
                                                        {formData.plan === 'basic' && <CheckCircle className="w-5 h-5 text-brand-primary" />}
                                                    </div>
                                                    <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight mb-2">{plans.basic.name}</h3>
                                                    <div className="mb-6">
                                                        <span className="text-3xl font-black text-brand-dark">{formatPrice(plans.basic.price)}</span>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">/mo</span>
                                                    </div>
                                                    <ul className="space-y-3 mb-8 flex-grow">
                                                        {plans.basic.features.filter(f => f.available).slice(0, 3).map((f, i) => (
                                                            <li key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary"></div> {f.text}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </button>
                                            )}

                                            {/* Pro Plan Card */}
                                            {plans.pro && (
                                                <button 
                                                    type="button"
                                                    onClick={() => setFormData({...formData, plan: 'pro'})}
                                                    className={`relative p-8 rounded-[40px] text-left transition-all border-2 flex flex-col h-full ${
                                                        formData.plan === 'pro' 
                                                        ? 'bg-brand-dark border-brand-primary shadow-2xl shadow-brand-dark/30 ring-4 ring-brand-primary/5 text-white' 
                                                        : 'bg-slate-50 border-transparent hover:bg-white hover:border-slate-200 grayscale opacity-60'
                                                    }`}
                                                >
                                                    <div className="absolute top-4 right-8 bg-brand-primary text-brand-dark text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full">Popular</div>
                                                    <div className="mb-6 flex justify-between items-start">
                                                        <div className={`p-3 rounded-2xl ${formData.plan === 'pro' ? 'bg-brand-primary/20 text-brand-primary' : 'bg-slate-200 text-slate-400'}`}>
                                                            <Sparkles className="w-6 h-6" />
                                                        </div>
                                                        {formData.plan === 'pro' && <CheckCircle className="w-5 h-5 text-brand-primary" />}
                                                    </div>
                                                    <h3 className={`text-xl font-black uppercase tracking-tight mb-2 ${formData.plan === 'pro' ? 'text-white' : 'text-brand-dark'}`}>{plans.pro.name}</h3>
                                                    <div className="mb-6">
                                                        <span className={`text-3xl font-black ${formData.plan === 'pro' ? 'text-brand-primary' : 'text-brand-dark'}`}>{formatPrice(plans.pro.price)}</span>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">/mo</span>
                                                    </div>
                                                    <ul className="space-y-3 mb-8 flex-grow">
                                                        {plans.pro.features.filter(f => f.available).slice(0, 3).map((f, i) => (
                                                            <li key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-300">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-brand-primary"></div> {f.text}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </button>
                                            )}

                                            {/* Pay As You Go Plan Card */}
                                            {plans.pay_as_you_go && (
                                                <button 
                                                    type="button"
                                                    onClick={() => setFormData({...formData, plan: 'pay_as_you_go'})}
                                                    className={`relative p-8 rounded-[40px] text-left transition-all border-2 flex flex-col h-full ${
                                                        formData.plan === 'pay_as_you_go' 
                                                        ? 'bg-white border-amber-500 shadow-2xl shadow-amber-500/10 ring-4 ring-amber-500/5' 
                                                        : 'bg-slate-50 border-transparent hover:bg-white hover:border-slate-200 grayscale opacity-60'
                                                    }`}
                                                >
                                                    <div className="mb-6 flex justify-between items-start">
                                                        <div className={`p-3 rounded-2xl ${formData.plan === 'pay_as_you_go' ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>
                                                            <Zap className="w-6 h-6" />
                                                        </div>
                                                        {formData.plan === 'pay_as_you_go' && <CheckCircle className="w-5 h-5 text-amber-500" />}
                                                    </div>
                                                    <h3 className="text-xl font-black text-brand-dark uppercase tracking-tight mb-2">{plans.pay_as_you_go.name}</h3>
                                                    <div className="mb-6">
                                                        <span className="text-3xl font-black text-brand-dark">₹{formatPrice(plans.pay_as_you_go.price)}</span>
                                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">/token</span>
                                                    </div>
                                                    <ul className="space-y-3 mb-8 flex-grow">
                                                        {plans.pay_as_you_go.features.filter(f => f.available).slice(0, 3).map((f, i) => (
                                                            <li key={i} className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div> {f.text}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <p className="text-center text-[10px] font-black text-slate-400 uppercase tracking-widest px-10">
                                        You are selecting a <span className="text-brand-dark underline decoration-brand-primary decoration-2">{formData.plan.toUpperCase()}</span> plan request. 
                                        Payment is required only after approval.
                                    </p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="pt-8 flex flex-col md:flex-row gap-6">
                                {activeTab !== 'basic' && (
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            if (activeTab === 'plan') setActiveTab('location');
                                            else if (activeTab === 'location') setActiveTab('admin');
                                            else if (activeTab === 'admin') setActiveTab('basic');
                                        }}
                                        className="flex-1 py-4 bg-white border-2 border-slate-100 text-slate-400 rounded-3xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all hover:border-slate-200"
                                    >
                                        Previous Step
                                    </button>
                                )}
                                
                                {activeTab !== 'plan' ? (
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            if (canMoveForward()) {
                                                if (activeTab === 'basic') setActiveTab('admin');
                                                else if (activeTab === 'admin') setActiveTab('location');
                                                else if (activeTab === 'location') setActiveTab('plan');
                                            } else {
                                                // Mark all current tab fields as touched
                                                const currentFields = activeTab === 'basic' ? ['labName', 'labFullName'] : ['ownerName', 'email', 'phone'];
                                                const newTouched = {...touched};
                                                currentFields.forEach(f => newTouched[f] = true);
                                                setTouched(newTouched);
                                            }
                                        }}
                                        className={`flex-[2] py-4 rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] transition-all flex items-center justify-center gap-3 shadow-xl ${
                                            canMoveForward() ? 'bg-brand-dark text-white hover:bg-black shadow-brand-dark/20' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                        }`}
                                        key="continue-button"
                                    >
                                        Continue <ArrowRight className="w-4 h-4 text-brand-primary" />
                                    </button>
                                ) : (
                                    <button 
                                        type="submit"
                                        key="submit-button"
                                        disabled={submitting || Object.keys(errors).length > 0 || loadingPlans}
                                        className={`flex-[2] py-4 bg-brand-primary text-brand-dark rounded-3xl font-black uppercase text-[10px] tracking-[0.3em] shadow-xl shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3 ${
                                            (submitting || Object.keys(errors).length > 0 || loadingPlans) ? 'opacity-50 cursor-not-allowed' : ''
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
                className={`w-full ${icon ? 'pl-14' : 'px-6'} py-4 bg-white border rounded-[28px] text-sm font-black text-brand-dark outline-none transition-all shadow-sm ${
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
