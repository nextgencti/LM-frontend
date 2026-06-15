import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
    Activity, Zap, Shield, FileText, Globe, CheckCircle2, 
    Menu, X, ArrowRight, Star, Heart, Clock, Loader,
    Send, Mail, MessageCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

const Home = () => {
    const { currentUser, userData } = useAuth();
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [plans, setPlans] = useState({});
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [billingType, setBillingType] = useState('fixed');
    const [isPricingHovered, setIsPricingHovered] = useState(false);

    useEffect(() => {
        if (isPricingHovered) return;
        
        const interval = setInterval(() => {
            setBillingType(prev => prev === 'fixed' ? 'flexible' : 'fixed');
        }, 1000); // switch every 1 second

        return () => clearInterval(interval);
    }, [isPricingHovered]);

    useEffect(() => {
        window.scrollTo(0, 0);
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
        return priceStr; // Already formatted as string in DB
    };

    useEffect(() => {
        window.scrollTo(0, 0);
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const features = [
        {
            icon: <Zap className="w-6 h-6" />,
            title: "Lightning Fast Sync",
            desc: "Sync records between offline systems and cloud in milliseconds. Never lose a report again."
        },
        {
            icon: <Shield className="w-6 h-6" />,
            title: "Enterprise Security",
            desc: "Bank-grade encryption for all patient data. Fully compliant with clinical data standards."
        },
        {
            icon: <FileText className="w-6 h-6" />,
            title: "Automated Reporting",
            desc: "Generate professional, branded PDF reports automatically. Email them to patients with one click."
        },
        {
            icon: <Globe className="w-6 h-6" />,
            title: "Remote Access",
            desc: "Access your lab's data from anywhere in the world. Manage multiple branches seamlessly."
        }
    ];

    const stats = [
        { label: "Active Laboratories", value: "50+" },
        { label: "Reports Generated", value: "100k+" },
        { label: "Uptime Guaranteed", value: "99.9%" },
        { label: "Happy Patients", value: "25k+" }
    ];

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-brand-primary/30 selection:text-brand-dark">
            
            {/* Navigation */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'py-3 bg-white/80 backdrop-blur-xl shadow-lg border-b border-slate-100' : 'py-4 bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                    <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/')}>
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden flex items-center justify-center p-1 transition-transform group-hover:scale-110">
                            <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-xl font-bold tracking-tight uppercase text-brand-dark">Lab <span className="text-brand-primary">Mitra</span></h1>
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-[12px] font-bold uppercase tracking-wider text-slate-500">
                        <a href="#features" className="hover:text-brand-primary transition-colors">Features</a>
                        <Link to="/about" className="hover:text-brand-primary transition-colors">About Us</Link>
                        <a href="#stats" className="hover:text-brand-primary transition-colors">Stats</a>
                        {currentUser ? (
                            <Link to="/dashboard" className="px-5 py-2.5 bg-brand-dark text-white rounded-xl shadow-xl shadow-brand-dark/20 hover:scale-105 active:scale-95 transition-all">Go to Dashboard</Link>
                        ) : (
                            <>
                                <Link to="/login" className="hover:text-brand-dark transition-colors">Login</Link>
                                <Link to="/signup" className="px-5 py-2.5 bg-brand-primary text-brand-dark rounded-xl shadow-lg shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all">Get Started</Link>
                            </>
                        )}
                    </div>

                    <button className="md:hidden p-2 text-brand-dark" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                        {mobileMenuOpen ? <X /> : <Menu />}
                    </button>
                </div>
            </nav>

            {/* Mobile Menu */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-[60] bg-white md:hidden animate-in fade-in slide-in-from-right duration-500 overflow-y-auto">
                    <div className="flex flex-col h-full bg-white relative">
                        {/* Menu Header */}
                        <div className="px-6 py-8 flex justify-between items-center border-b border-slate-50">
                            <div className="flex items-center gap-3" onClick={() => navigate('/')}>
                                <div className="w-10 h-10 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex items-center justify-center p-1">
                                    <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
                                </div>
                                <h1 className="text-xl font-bold tracking-tight uppercase text-brand-dark">Lab <span className="text-brand-primary">Mitra</span></h1>
                            </div>
                            <button 
                                onClick={() => setMobileMenuOpen(false)}
                                className="p-2 bg-slate-100/50 text-slate-400 rounded-xl hover:text-brand-dark transition-all border border-slate-100 active:scale-90"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Menu Links */}
                        <div className="flex-grow px-8 py-8">
                            <div className="flex flex-col gap-6">
                                <a href="#features" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-xl font-bold text-brand-dark flex items-center justify-between group animate-in slide-in-from-left duration-500 delay-100 fill-mode-both"
                                >
                                    <span className="group-hover:translate-x-2 transition-transform">Features</span>
                                    <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all text-brand-primary" />
                                </a>
                                <a href="#stats" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-xl font-bold text-brand-dark flex items-center justify-between group animate-in slide-in-from-left duration-500 delay-200 fill-mode-both"
                                >
                                    <span className="group-hover:translate-x-2 transition-transform">Stats</span>
                                    <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all text-brand-primary" />
                                </a>

                                <Link to="/about" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-xl font-bold text-brand-dark flex items-center justify-between group animate-in slide-in-from-left duration-500 delay-300 fill-mode-both"
                                >
                                    <span className="group-hover:translate-x-2 transition-transform">About Us</span>
                                    <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all text-brand-primary" />
                                </Link>
                                <Link to="/login" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-xl font-bold text-brand-dark flex items-center justify-between group animate-in slide-in-from-left duration-500 delay-300 fill-mode-both"
                                >
                                    <span className="group-hover:translate-x-2 transition-transform">Login</span>
                                    <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all text-brand-primary" />
                                </Link>
                                <Link to="/signup" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="px-6 py-4 bg-brand-primary text-brand-dark text-center rounded-2xl font-bold uppercase tracking-wider text-[11px] shadow-xl shadow-brand-primary/20 mt-4 animate-in slide-in-from-bottom duration-700 delay-400 fill-mode-both flex items-center justify-center gap-2"
                                >
                                    Get Started Free <ArrowRight className="w-4 h-4" />
                                </Link>
                            </div>
                        </div>

                        {/* Menu Footer */}
                        <div className="p-10 border-t border-slate-50 bg-slate-50/50 flex flex-col items-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6 animate-pulse">Precision pathology infrastructure</p>
                            <div className="flex justify-center gap-8 text-slate-300">
                                <Shield className="w-6 h-6 hover:text-brand-dark transition-colors" />
                                <div className="w-px h-6 bg-slate-200"></div>
                                <Zap className="w-6 h-6 hover:text-brand-primary transition-colors" />
                                <div className="w-px h-6 bg-slate-200"></div>
                                <Globe className="w-6 h-6 hover:text-blue-500 transition-colors" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Hero Section */}
            <section className="relative pt-24 lg:pt-32 pb-12 overflow-hidden">
                <div className="absolute top-0 right-0 -z-10 w-2/3 h-full bg-brand-light/20 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2 animate-float"></div>
                <div className="absolute bottom-0 left-0 -z-10 w-1/3 h-1/2 bg-brand-primary/10 blur-[100px] rounded-full -translate-x-1/2 translate-y-1/2 animate-float" style={{ animationDelay: '2s' }}></div>
                
                <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
                    <div className="animate-in fade-in slide-in-from-left-10 duration-1000">
                        <div className="inline-flex items-center gap-2 bg-brand-light px-3 py-1.5 rounded-full border border-brand-primary/20 mb-6">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-dark">V2.0 Now Live - Multi-Branch Sync</span>
                        </div>
                        <h2 className="text-4xl sm:text-5xl font-bold text-brand-dark leading-[1.1] tracking-tight mb-5 animate-in slide-in-from-bottom duration-700 delay-200">
                            Pathology <span className="text-brand-primary italic text-[0.85em]">Simplified.</span> <br />
                            Precision <span className="text-brand-secondary text-[0.85em]">Guaranteed.</span>
                        </h2>
                        <p className="text-base text-slate-500 font-medium leading-relaxed mb-8 max-w-xl">
                            The all-in-one cloud platform designed for modern laboratories. From booking to reporting, manage your entire pathology workflow with surgical precision.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 animate-in slide-in-from-bottom duration-700 delay-300">
                            <Link to="/signup" className="px-6 py-3 bg-brand-dark text-white text-[12px] font-bold uppercase tracking-wider rounded-xl shadow-xl shadow-brand-dark/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                                Start Free Trial <ArrowRight className="w-4 h-4 text-brand-primary" />
                            </Link>
                            <button className="px-6 py-3 bg-white border border-slate-200 text-brand-dark text-[12px] font-bold uppercase tracking-wider rounded-xl shadow-sm hover:bg-slate-50 transition-all active:scale-95">
                                Request Demo
                            </button>
                        </div>
                        <div className="mt-8 flex items-center gap-6">
                            <div className="flex -space-x-3">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className={`w-12 h-12 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center overflow-hidden`}>
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 40}`} alt="avatar" />
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col">
                                <div className="flex text-amber-500 mb-1">
                                    {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trusted by over 500+ path labs</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative animate-in fade-in slide-in-from-right-10 duration-1000 delay-300">
                        <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl border-4 border-white group">
                            <img 
                                src="/pathology_dashboard_mockup.png" 
                                alt="Dashboard Mockup" 
                                className="w-full h-auto transform group-hover:scale-105 transition-transform duration-1000"
                                onError={(e) => {
                                    // Fallback if the path is complex
                                    e.target.src = 'https://images.unsplash.com/photo-1579154235602-3c37ef3f0766?auto=format&fit=crop&q=80&w=2000';
                                }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-brand-dark/20 to-transparent"></div>
                        </div>
                        {/* Floating Cards */}
                        <div className="absolute -top-6 -left-4 sm:-left-8 z-20 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg animate-float max-w-[180px]">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-brand-primary/20 rounded-lg"><Heart className="w-4 h-4 text-brand-dark" /></div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Accuracy</span>
                            </div>
                            <div className="text-xl font-bold text-brand-dark">99.98%</div>
                        </div>
                        <div className="absolute -bottom-6 -right-4 sm:-right-8 z-20 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-lg animate-float max-w-[180px]" style={{ animationDelay: '1.5s' }}>
                            <div className="flex items-center gap-2 mb-2">
                                <div className="p-1.5 bg-emerald-500/20 rounded-lg"><Clock className="w-4 h-4 text-emerald-600" /></div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Speed</span>
                            </div>
                            <div className="text-xl font-bold text-brand-dark">-2.4 hrs</div>
                            <div className="text-[9px] font-medium text-emerald-600 mt-0.5 uppercase tracking-wider">Avg Report Time</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-20 bg-slate-50 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h3 className="text-brand-primary font-bold uppercase tracking-widest mb-3 text-xs">Advanced Infrastructure</h3>
                        <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-4 tracking-tight leading-tight">Built for the future of clinical medicine.</h2>
                        <p className="text-base text-slate-500 font-medium leading-relaxed">Everything you need to run a high-performance pathology lab, unified on a single platform.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {features.map((f, i) => (
                            <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 hover:border-brand-primary/30 transition-all hover:shadow-xl shadow-sm group">
                                <div className="w-12 h-12 bg-brand-light/50 rounded-xl flex items-center justify-center text-brand-primary mb-6 group-hover:scale-110 transition-transform">
                                    {f.icon}
                                </div>
                                <h4 className="text-lg font-bold text-brand-dark mb-2 tracking-tight">{f.title}</h4>
                                <p className="text-slate-500 font-medium leading-relaxed text-[13px]">
                                    {f.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section id="stats" className="py-20 bg-brand-dark relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full pattern-grid opacity-5"></div>
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 text-center">
                        {stats.map((s, i) => (
                            <div key={i} className="flex flex-col">
                                <div className="text-3xl md:text-4xl font-bold text-brand-primary mb-2 tracking-tight transition-transform hover:scale-110 duration-500 cursor-default">{s.value}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section 
                id="pricing" 
                className="py-24 bg-slate-50 relative overflow-hidden"
                onMouseEnter={() => setIsPricingHovered(true)}
                onMouseLeave={() => setIsPricingHovered(false)}
                onTouchStart={() => setIsPricingHovered(true)}
                onTouchEnd={() => setIsPricingHovered(false)}
            >
                {/* Background Decorations */}
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-primary/5 rounded-full blur-[150px] -mr-96 -mt-96 pointer-events-none"></div>
                
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="text-center max-w-2xl mx-auto mb-12">
                        <div className="inline-flex items-center gap-2 bg-brand-primary/10 px-4 py-1.5 rounded-full border border-brand-primary/20 mb-6">
                           <Activity className="w-3.5 h-3.5 text-brand-primary" />
                           <span className="text-[10px] font-bold uppercase tracking-widest text-brand-dark">Investment Models</span>
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold text-brand-dark mb-4 tracking-tight leading-tight">
                           Plans for every <span className="text-brand-primary underline decoration-brand-primary/30 underline-offset-4">Scale</span>.
                        </h2>
                        <p className="text-base text-slate-500 font-medium leading-relaxed">
                           From scaling startups to enterprise laboratories, choose the model that fits your operational needs.
                        </p>
                        
                        {/* THE TOGGLE - High Fidelity */}
                        <div className="mt-8 inline-flex items-center p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200 shadow-inner group">
                           <button 
                               onClick={() => setBillingType('fixed')}
                               className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${billingType === 'fixed' ? 'bg-white text-brand-dark shadow border border-slate-200' : 'text-slate-500 hover:text-brand-dark'}`}
                           >
                              <Shield className={`w-3.5 h-3.5 ${billingType === 'fixed' ? 'text-brand-primary' : ''}`} />
                              Fixed Subscriptions
                           </button>
                           <button 
                               onClick={() => setBillingType('flexible')}
                               className={`px-5 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${billingType === 'flexible' ? 'bg-brand-dark text-brand-primary shadow border border-brand-dark' : 'text-slate-500 hover:text-brand-dark'}`}
                           >
                              <Zap className={`w-3.5 h-3.5 ${billingType === 'flexible' ? 'text-brand-primary' : ''}`} />
                              Flexible (Tokens)
                           </button>
                        </div>
                    </div>

                    <div className="flex flex-col items-center">
                        {loadingPlans ? (
                            <div className="w-full py-16 flex flex-col items-center justify-center bg-white rounded-3xl shadow-sm border border-slate-100">
                                <Loader className="w-8 h-8 animate-spin text-brand-primary mb-3" />
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Accessing Real-time pricing...</p>
                            </div>
                        ) : (() => {
                            const fixedPlans = Object.values(plans)
                                .sort((a, b) => (a.order || 0) - (b.order || 0))
                                .filter(p => p.id !== 'pay_as_you_go');
                            
                            const flexiblePlans = Object.values(plans)
                                .sort((a, b) => (a.order || 0) - (b.order || 0))
                                .filter(p => p.id === 'pay_as_you_go');

                            return (
                                <div className="grid w-full relative max-w-7xl mx-auto">
                                    {/* Fixed Plans Container */}
                                    <div 
                                        className={`col-start-1 row-start-1 transition-all duration-500 ease-in-out flex flex-col md:flex-row gap-6 w-full items-stretch justify-center max-w-4xl mx-auto ${
                                            billingType === 'fixed' ? 'opacity-100 z-10 translate-y-0' : 'opacity-0 pointer-events-none z-0 translate-y-4'
                                        }`}
                                    >
                                        {fixedPlans.map(plan => {
                                            const isPro = plan.id === 'pro';
                                            return (
                                                <div 
                                                    key={plan.id}
                                                    className={`w-full flex-1 p-6 rounded-3xl flex flex-col transition-all duration-700 relative overflow-hidden group border ${
                                                        isPro 
                                                        ? 'bg-brand-dark border-white/5 hover:translate-y-[-8px] hover:shadow-[0_20px_40px_-10px_rgba(151,250,11,0.2)] shadow-xl' 
                                                        : 'bg-white border-slate-200 hover:translate-y-[-6px] hover:shadow-lg shadow-md'
                                                    }`}
                                                >
                                                    {/* Background Accents */}
                                                    {isPro ? (
                                                        <>
                                                            <div className={`absolute top-0 right-0 w-48 h-48 blur-[60px] rounded-full -translate-y-1/2 translate-x-1/2 transition-all duration-700 bg-brand-primary/20 group-hover:bg-brand-primary/30`}></div>
                                                            <div className={`absolute bottom-0 left-0 w-32 h-32 blur-[40px] rounded-full translate-y-1/2 -translate-x-1/2 bg-brand-secondary/10 opacity-50`}></div>
                                                        </>
                                                    ) : (
                                                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 blur-[40px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:scale-125 transition-transform duration-1000"></div>
                                                    )}
                                                    
                                                    <div className={`text-[9px] font-bold uppercase tracking-wider mb-6 inline-block w-fit px-3 py-1.5 rounded-full ring-1 ${
                                                        isPro 
                                                        ? 'bg-brand-primary/10 text-brand-primary ring-brand-primary/30' 
                                                        : 'bg-slate-50 text-slate-500 ring-slate-200'
                                                    }`}>
                                                        {plan.popular ? 'Recommended Choice' : 'Stable Entry'}
                                                    </div>

                                                    <h5 className={`text-2xl font-bold mb-2 tracking-tight uppercase ${isPro ? 'text-white' : 'text-brand-dark'}`}>
                                                        {plan.name}
                                                    </h5>
                                                    <p className={`font-medium text-[13px] leading-relaxed mb-6 ${isPro ? 'text-slate-400' : 'text-slate-500'}`}>
                                                        {plan.description}
                                                    </p>
                                                    
                                                    <div className={`flex items-baseline mb-8 p-5 rounded-2xl border transition-colors ${
                                                        isPro 
                                                        ? 'bg-white/5 border-white/5 backdrop-blur-md shadow-inner' 
                                                        : 'bg-slate-50 border-slate-100'
                                                    }`}>
                                                        <span className={`text-3xl font-bold tabular-nums tracking-tight ${isPro ? 'text-brand-primary' : 'text-brand-dark'}`}>
                                                            {formatPrice(plan.price)}
                                                        </span>
                                                        <span className={`text-xs font-bold uppercase tracking-wider ml-2 ${isPro ? 'text-slate-400' : 'text-slate-500'}`}>
                                                            {plan.period}
                                                        </span>
                                                    </div>
                                                    
                                                    <div className="space-y-3 mb-8 flex-grow">
                                                        {plan.features?.filter(f => f.available).map((feature, i) => (
                                                            <div key={i} className={`flex items-start gap-3 text-xs font-semibold transition-all group-hover:translate-x-1 ${isPro ? 'text-slate-200' : 'text-slate-600'}`}>
                                                                <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                                                                    isPro 
                                                                    ? 'text-brand-primary' 
                                                                    : 'text-emerald-500'
                                                                }`}>
                                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                                </div>
                                                                <span className="leading-snug">{feature.text}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    
                                                    <Link 
                                                        to="/signup" 
                                                        className={`block w-full text-center py-3 font-bold rounded-xl transition-all shadow-md uppercase text-[11px] tracking-wider active:scale-95 ${
                                                            isPro
                                                            ? 'bg-brand-primary text-brand-dark shadow-brand-primary/20 hover:shadow-brand-primary/40'
                                                            : 'bg-brand-dark text-white shadow-brand-dark/10 hover:bg-black'
                                                        }`}
                                                    >
                                                        Plan Details
                                                    </Link>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Flexible Plans Container */}
                                    <div 
                                        className={`col-start-1 row-start-1 transition-all duration-500 ease-in-out flex justify-center max-w-6xl mx-auto w-full items-start ${
                                            billingType === 'flexible' ? 'opacity-100 z-10 translate-y-0' : 'opacity-0 pointer-events-none z-0 translate-y-4'
                                        }`}
                                    >
                                        <div className="flex flex-col md:flex-row gap-6 w-full items-stretch">
                                            {flexiblePlans.map(plan => (
                                            <React.Fragment key={plan.id}>
                                                {/* Explanation Card for Tokens */}
                                                <div className="w-full md:w-[35%] flex flex-col justify-between p-6 bg-slate-900 rounded-3xl text-white overflow-hidden relative group border border-white/5 order-1">
                                                    <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 blur-[100px] rounded-full -mr-32 -mt-32"></div>
                                                    <h4 className="text-xl font-bold mb-6 tracking-tight uppercase">How it <span className="text-brand-primary">Works</span></h4>
                                                    <div className="space-y-6 relative z-10">
                                                        <div className="flex gap-4">
                                                            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10 italic text-brand-primary font-bold text-sm">01</div>
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">Buy Tokens</p>
                                                                <p className="text-xs font-medium text-slate-400">Recharge your wallet with report tokens anytime.</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-4">
                                                            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10 italic text-brand-primary font-bold text-sm">02</div>
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">Single Deduction</p>
                                                                <p className="text-xs font-medium text-slate-400">1 Token is deducted only when you preview/print a finalized report.</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-4">
                                                            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10 italic text-brand-primary font-bold text-sm">03</div>
                                                            <div>
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-primary mb-1">No Expiry</p>
                                                                <p className="text-xs font-medium text-slate-400">Your tokens never expire. Use them at your laboratory's own pace.</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* The Flexible Plan Card */}
                                                <div className="w-full md:w-[65%] p-6 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-8 relative overflow-hidden group order-2">
                                                    <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 blur-[100px] rounded-full -mr-48 -mt-48 transition-all group-hover:bg-amber-500/10"></div>
                                                    
                                                    <div className="flex-1 z-10">
                                                        <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full mb-6">
                                                            <Zap className="w-3.5 h-3.5 text-amber-500 animate-pulse fill-amber-500" />
                                                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">The Power of Choice</span>
                                                        </div>
                                                        <h3 className="text-3xl font-bold text-brand-dark mb-3 tracking-tight uppercase">{plan.name}</h3>
                                                        <p className="text-slate-500 font-medium leading-relaxed mb-8 text-sm">{plan.description}</p>
                                                        
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {plan.features?.filter(f => f.available).map((f, idx) => (
                                                                <div key={idx} className="flex items-center gap-2">
                                                                    <CheckCircle2 className="w-4 h-4 text-amber-500" />
                                                                    <span className="text-xs font-semibold tracking-wide text-slate-700">{f.text}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="md:w-64 flex flex-col items-center justify-center p-6 bg-slate-50 rounded-2xl border border-slate-100 relative z-10">
                                                        <div className="text-center mb-6">
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Starts from</p>
                                                            <div className="text-3xl font-bold text-brand-dark tabular-nums tracking-tight">
                                                                ₹{plan.price}
                                                            </div>
                                                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mt-1">Per Token</p>
                                                        </div>
                                                        <Link 
                                                            to="/signup" 
                                                            className="w-full py-3 bg-brand-dark text-white text-center rounded-xl font-bold uppercase tracking-wider text-[11px] shadow-lg shadow-brand-dark/20 hover:scale-105 active:scale-95 transition-all"
                                                        >
                                                            Choose Flexible
                                                        </Link>
                                                    </div>
                                                </div>
                                            </React.Fragment>
                                        ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </section>

            {/* Premium Footer */}
            <footer className="bg-slate-950 pt-20 pb-8 border-t border-white/5 relative overflow-hidden">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-primary/10 rounded-full blur-[150px] -mr-48 -mt-48 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -ml-48 -mb-48 pointer-events-none"></div>
                <div className="absolute inset-0 pattern-grid opacity-[0.03] pointer-events-none"></div>

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid lg:grid-cols-12 gap-10 mb-12">
                        {/* Brand Section */}
                        <div className="lg:col-span-4 space-y-10">
                            <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/')}>
                                <div className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex items-center justify-center p-1.5 transition-all group-hover:scale-110 group-hover:border-brand-primary/50">
                                    <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
                                </div>
                                <h1 className="text-2xl font-black text-white tracking-tighter uppercase">Lab <span className="text-brand-primary">Mitra</span></h1>
                            </div>
                            <p className="text-lg text-slate-400 font-medium leading-relaxed max-w-sm">
                                The definitive cloud infrastructure for modern diagnostic excellence. Precision synchronized across your entire clinical workflow.
                            </p>
                            <div className="flex gap-4">
                                {[
                                    { icon: <Globe className="w-5 h-5" />, href: "#" },
                                    { icon: <Zap className="w-5 h-5" />, href: "#" },
                                    { icon: <MessageCircle className="w-5 h-5" />, href: "#" },
                                    { icon: <Mail className="w-5 h-5" />, href: "#" }
                                ].map((social, i) => (
                                    <a key={i} href={social.href} className="w-11 h-11 bg-white/5 text-slate-400 rounded-xl flex items-center justify-center border border-white/5 hover:bg-brand-primary hover:text-brand-dark transition-all transform hover:-translate-y-1">
                                        {social.icon}
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Link Columns */}
                        <div className="lg:col-span-5 grid grid-cols-2 md:grid-cols-3 gap-8">
                            <div className="space-y-8">
                                <h6 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary">Platform</h6>
                                <ul className="space-y-4 text-sm font-bold text-slate-500">
                                    <li><a href="#features" className="hover:text-white transition-colors flex items-center gap-2 group"><span className="w-1.5 h-1.5 rounded-full bg-brand-primary/0 group-hover:bg-brand-primary transition-all"></span> Features</a></li>
                                    <li><a href="#pricing" className="hover:text-white transition-colors flex items-center gap-2 group"><span className="w-1.5 h-1.5 rounded-full bg-brand-primary/0 group-hover:bg-brand-primary transition-all"></span> Pricing Plans</a></li>
                                    <li><a href="#stats" className="hover:text-white transition-colors flex items-center gap-2 group"><span className="w-1.5 h-1.5 rounded-full bg-brand-primary/0 group-hover:bg-brand-primary transition-all"></span> Global Impact</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors flex items-center gap-2 group"><span className="w-1.5 h-1.5 rounded-full bg-brand-primary/0 group-hover:bg-brand-primary transition-all"></span> API Docs</a></li>
                                </ul>
                            </div>
                            <div className="space-y-8">
                                <h6 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary">Company</h6>
                                <ul className="space-y-4 text-sm font-bold text-slate-500">
                                    <li><Link to="/about" className="hover:text-white transition-colors">Our Mission</Link></li>
                                    <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors">Newsroom</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
                                </ul>
                            </div>
                            <div className="space-y-8 col-span-2 md:col-span-1">
                                <h6 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary">Legal</h6>
                                <ul className="space-y-4 text-sm font-bold text-slate-500">
                                    <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors">Terms</a></li>
                                    <li><a href="#" className="hover:text-white transition-colors">Cookies</a></li>
                                </ul>
                            </div>
                        </div>

                        {/* Newsletter Section */}
                        <div className="lg:col-span-3 space-y-8">
                            <h6 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-primary">Stay Updated</h6>
                            <p className="text-sm font-medium text-slate-400 leading-relaxed">
                                Join our monthly briefing on clinical technology and lab management.
                            </p>
                            <div className="relative group">
                                <input 
                                    type="email" 
                                    placeholder="Enter your email"
                                    className="w-full h-14 bg-white/5 border border-white/10 rounded-2xl px-6 text-sm font-bold text-white outline-none focus:bg-white/10 focus:border-brand-primary transition-all pr-14"
                                />
                                <button className="absolute right-2 top-2 bottom-2 w-10 h-10 bg-brand-primary text-brand-dark rounded-xl flex items-center justify-center hover:scale-105 transition-transform active:scale-95 shadow-xl shadow-brand-primary/20">
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-slate-500 pt-4">
                                <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                                    <Globe className="w-4 h-4 text-brand-primary" />
                                </div>
                                <span>Based in Muskara, UP</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Bar */}
                    <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
                            © 2026 LabMitra Global Healthcare. All Rights Reserved.
                        </p>
                        <div className="flex items-center gap-4 bg-white/5 px-6 py-2.5 rounded-full border border-white/5 backdrop-blur-md">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
                            </span>
                            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Global Infrastructure Live</span>
                        </div>
                    </div>
                </div>
            </footer>

            {/* Floating WhatsApp Button */}
            <div className="fixed bottom-4 right-4 md:bottom-8 md:right-8 z-[100] group flex items-center justify-center">
                {/* Continuous Pulse Animation Ring */}
                <div className="absolute inset-0 rounded-full bg-[#25D366] opacity-30 animate-ping"></div>
                
                {/* Main WhatsApp Button */}
                <a 
                    href="https://wa.me/919140737374" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="relative bg-[#25D366] text-white p-3 md:p-4 rounded-full shadow-[0_10px_40px_-10px_rgba(37,211,102,0.8)] hover:scale-110 active:scale-95 transition-all flex items-center justify-center border-2 md:border-4 border-white/20 backdrop-blur-md"
                    aria-label="Need Help? Chat on WhatsApp"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" fill="currentColor" className="w-6 h-6 md:w-8 md:h-8 relative z-10 animate-bounce" style={{ animationDuration: '2s' }}>
                        <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zM223.9 414.3h-.1c-32.9 0-65.2-8.8-93.5-25.5l-6.7-4-69.5 18.2L72.5 334l-4.4-7c-18.4-29.4-28.1-63.5-28.1-98.3 0-102.8 83.5-186.3 189.1-186.3 49.8 0 96.6 19.4 131.8 54.6 35.2 35.2 54.6 82 54.6 131.8 0 102.8-83.6 186.3-189.1 186.3zm103.5-141.2c-5.7-2.8-33.6-16.6-38.8-18.5-5.2-1.9-9-2.8-12.8 2.8-3.8 5.7-14.7 18.5-18 22.3-3.3 3.8-6.6 4.3-12.3 1.4-5.7-2.8-24-8.8-45.7-28.2-16.9-15.1-28.3-33.8-31.6-39.5-3.3-5.7-.3-8.8 2.6-11.6 2.6-2.6 5.7-6.6 8.5-9.9 2.8-3.3 3.8-5.7 5.7-9.5 1.9-3.8.9-7.1-.5-9.9-1.4-2.8-12.8-30.8-17.5-42.2-4.6-11.1-9.3-9.6-12.8-9.8-3.3-.2-7.1-.2-11-.2-3.8 0-10 1.4-15.2 7.1-5.2 5.7-20.1 19.7-20.1 48.1 0 28.4 20.6 55.9 23.4 59.7 2.8 3.8 40.8 62.3 98.9 87.4 13.8 6 24.6 9.6 33 12.3 13.8 4.4 26.4 3.8 36.3 2.3 11.2-1.7 33.6-13.7 38.3-27 4.7-13.3 4.7-24.6 3.3-27-.9-2.8-4.7-4.2-10.4-7.1z"/>
                    </svg>
                </a>

                {/* Hover Tooltip */}
                <div className="absolute right-full mr-4 bg-white text-slate-800 text-[11px] font-black uppercase tracking-widest px-4 py-2 rounded-2xl shadow-[0_10px_30px_-5px_rgba(0,0,0,0.1)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-slate-100">
                    Need Help?
                </div>
            </div>
        </div>
    );
};

export default Home;
