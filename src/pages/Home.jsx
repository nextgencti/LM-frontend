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
        if (!priceStr) return { monthly: '0', yearly: '0' };
        const numeric = parseInt(priceStr.replace(/[^0-9]/g, '')) || 0;
        return {
            monthly: Math.floor(numeric / 12).toLocaleString(),
            yearly: numeric.toLocaleString()
        };
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
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'py-4 bg-white/80 backdrop-blur-xl shadow-lg border-b border-slate-100' : 'py-6 bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                    <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/')}>
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden flex items-center justify-center p-1 transition-transform group-hover:scale-110">
                            <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-xl md:text-2xl font-black tracking-tighter uppercase text-brand-dark">Lab <span className="text-brand-primary">Mitra</span></h1>
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-[13px] font-black uppercase tracking-widest text-slate-500">
                        <a href="#features" className="hover:text-brand-primary transition-colors">Features</a>
                        <Link to="/about" className="hover:text-brand-primary transition-colors">About Us</Link>
                        <a href="#stats" className="hover:text-brand-primary transition-colors">Stats</a>
                        {currentUser ? (
                            <Link to="/dashboard" className="px-6 py-3 bg-brand-dark text-white rounded-2xl shadow-xl shadow-brand-dark/20 hover:scale-105 active:scale-95 transition-all">Go to Dashboard</Link>
                        ) : (
                            <>
                                <Link to="/login" className="hover:text-brand-dark transition-colors">Login</Link>
                                <Link to="/login" className="px-6 py-3 bg-brand-primary text-brand-dark rounded-2xl shadow-xl shadow-brand-primary/20 hover:scale-105 active:scale-95 transition-all">Get Started</Link>
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
                                <div className="w-10 h-10 bg-white rounded-xl shadow-md border border-slate-50 overflow-hidden flex items-center justify-center p-1">
                                    <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
                                </div>
                                <h1 className="text-xl font-black tracking-tighter uppercase text-brand-dark">Lab <span className="text-brand-primary">Mitra</span></h1>
                            </div>
                            <button 
                                onClick={() => setMobileMenuOpen(false)}
                                className="p-3 bg-slate-100/50 text-slate-400 rounded-[18px] hover:text-brand-dark transition-all border border-slate-100 active:scale-90"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Menu Links */}
                        <div className="flex-grow px-8 py-10">
                            <div className="flex flex-col gap-6">
                                <a href="#features" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-2xl font-black text-brand-dark flex items-center justify-between group animate-in slide-in-from-left duration-500 delay-100 fill-mode-both"
                                >
                                    <span className="group-hover:translate-x-2 transition-transform">Features</span>
                                    <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all text-brand-primary" />
                                </a>
                                <a href="#stats" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-2xl font-black text-brand-dark flex items-center justify-between group animate-in slide-in-from-left duration-500 delay-200 fill-mode-both"
                                >
                                    <span className="group-hover:translate-x-2 transition-transform">Stats</span>
                                    <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all text-brand-primary" />
                                </a>

                                <Link to="/about" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-2xl font-black text-brand-dark flex items-center justify-between group animate-in slide-in-from-left duration-500 delay-300 fill-mode-both"
                                >
                                    <span className="group-hover:translate-x-2 transition-transform">About Us</span>
                                    <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all text-brand-primary" />
                                </Link>
                                <Link to="/login" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="text-2xl font-black text-brand-dark flex items-center justify-between group animate-in slide-in-from-left duration-500 delay-300 fill-mode-both"
                                >
                                    <span className="group-hover:translate-x-2 transition-transform">Login</span>
                                    <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 -translate-x-4 group-hover:translate-x-0 transition-all text-brand-primary" />
                                </Link>
                                <Link to="/signup" 
                                    onClick={() => setMobileMenuOpen(false)}
                                    className="px-8 py-5 bg-brand-primary text-brand-dark text-center rounded-[24px] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl shadow-brand-primary/30 mt-6 animate-in slide-in-from-bottom duration-700 delay-400 fill-mode-both flex items-center justify-center gap-3"
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
            <section className="relative pt-48 pb-32 overflow-hidden">
                <div className="absolute top-0 right-0 -z-10 w-2/3 h-full bg-brand-light/20 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2 animate-float"></div>
                <div className="absolute bottom-0 left-0 -z-10 w-1/3 h-1/2 bg-brand-primary/10 blur-[100px] rounded-full -translate-x-1/2 translate-y-1/2 animate-float" style={{ animationDelay: '2s' }}></div>
                
                <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
                    <div className="animate-in fade-in slide-in-from-left-10 duration-1000">
                        <div className="inline-flex items-center gap-2 bg-brand-light px-4 py-2 rounded-full border border-brand-primary/20 mb-8">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
                            </span>
                            <span className="text-[11px] font-black uppercase tracking-widest text-brand-dark">V2.0 Now Live - Multi-Branch Sync</span>
                        </div>
                        <h2 className="text-4xl sm:text-5xl md:text-7xl font-black text-brand-dark leading-[1.1] md:leading-[1.05] tracking-tighter mb-8 animate-in slide-in-from-bottom duration-700 delay-200">
                            Pathology <span className="text-brand-primary italic text-[0.85em]">Simplified.</span> <br />
                            Precision <span className="text-brand-secondary text-[0.85em]">Guaranteed.</span>
                        </h2>
                        <p className="text-xl text-slate-500 font-bold leading-relaxed mb-10 max-w-xl">
                            The all-in-one cloud platform designed for modern laboratories. From booking to reporting, manage your entire pathology workflow with surgical precision.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 animate-in slide-in-from-bottom duration-700 delay-300">
                            <Link to="/signup" className="px-10 py-5 bg-brand-dark text-white text-lg font-black rounded-[28px] shadow-2xl shadow-brand-dark/30 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3">
                                Start Free Trial <ArrowRight className="w-5 h-5 text-brand-primary" />
                            </Link>
                            <button className="px-10 py-5 bg-white border-2 border-slate-100 text-brand-dark text-lg font-black rounded-[28px] shadow-lg hover:bg-slate-50 transition-all active:scale-95">
                                Request Demo
                            </button>
                        </div>
                        <div className="mt-12 flex items-center gap-6">
                            <div className="flex -space-x-3">
                                {[1,2,3,4].map(i => (
                                    <div key={i} className={`w-12 h-12 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center overflow-hidden`}>
                                        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 40}`} alt="avatar" />
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col">
                                <div className="flex text-amber-500 font-bold tracking-widest mb-1">
                                    {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-current" />)}
                                </div>
                                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Trusted by over 500+ path labs</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative animate-in fade-in slide-in-from-right-10 duration-1000 delay-300">
                        <div className="relative z-10 rounded-[48px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(45,50,80,0.2)] border-8 border-white group">
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
                        <div className="absolute -top-12 -left-6 sm:-left-12 z-20 glass-card p-6 rounded-3xl shadow-xl animate-float max-w-[200px]">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-brand-primary rounded-xl"><Heart className="w-5 h-5 text-brand-dark" /></div>
                                <span className="text-xs font-black uppercase tracking-widest">Accuracy</span>
                            </div>
                            <div className="text-2xl font-black text-brand-dark">99.98%</div>
                        </div>
                        <div className="absolute -bottom-10 -right-4 sm:-right-10 z-20 glass-card p-6 rounded-3xl shadow-xl animate-float max-w-[200px]" style={{ animationDelay: '1.5s' }}>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="p-2 bg-emerald-500 rounded-xl"><Clock className="w-5 h-5 text-white" /></div>
                                <span className="text-xs font-black uppercase tracking-widest">Speed</span>
                            </div>
                            <div className="text-2xl font-black text-brand-dark">-2.4 hrs</div>
                            <div className="text-[9px] font-bold text-emerald-600 mt-1 uppercase tracking-widest">Avg Report Time</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="py-32 bg-slate-50 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h3 className="text-brand-primary font-black uppercase tracking-[0.4em] mb-4 text-sm">Advanced Infrastructure</h3>
                        <h2 className="text-4xl md:text-5xl font-black text-brand-dark mb-6 tracking-tight leading-tight">Built for the future of clinical medicine.</h2>
                        <p className="text-lg text-slate-500 font-bold leading-relaxed">Everything you need to run a high-performance pathology lab, unified on a single platform.</p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                        {features.map((f, i) => (
                            <div key={i} className="bg-white p-10 rounded-[40px] border border-slate-100 hover:border-brand-primary/30 transition-all hover:shadow-2xl shadow-slate-200/50 group">
                                <div className="w-14 h-14 bg-brand-light/50 rounded-2xl flex items-center justify-center text-brand-primary mb-8 group-hover:scale-110 transition-transform">
                                    {f.icon}
                                </div>
                                <h4 className="text-xl font-black text-brand-dark mb-4 tracking-tight">{f.title}</h4>
                                <p className="text-slate-500 font-bold leading-relaxed text-sm">
                                    {f.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section id="stats" className="py-32 bg-brand-dark relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full pattern-grid opacity-5"></div>
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-12 text-center">
                        {stats.map((s, i) => (
                            <div key={i} className="flex flex-col">
                                <div className="text-5xl md:text-6xl font-black text-brand-primary mb-3 tracking-tighter transition-transform hover:scale-110 duration-500 cursor-default">{s.value}</div>
                                <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-32 bg-slate-50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h3 className="text-brand-primary font-black uppercase tracking-[0.4em] mb-4 text-sm">Flexible Pricing</h3>
                        <h2 className="text-4xl md:text-5xl font-black text-brand-dark mb-6 tracking-tight leading-tight">Plans designed for labs of all sizes.</h2>
                        <p className="text-lg text-slate-500 font-bold leading-relaxed">Choose a subscription that matches your laboratory's scale and ambition.</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-10 max-w-5xl mx-auto">
                        {loadingPlans ? (
                            <div className="col-span-2 py-20 flex flex-col items-center justify-center bg-white rounded-[50px] shadow-sm border border-slate-100">
                                <Loader className="w-10 h-10 animate-spin text-brand-primary mb-4" />
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accessing Real-time pricing...</p>
                            </div>
                        ) : (
                            <>
                                {/* Basic Plan */}
                                {plans.basic && (
                                    <div className="bg-white p-12 rounded-[50px] shadow-2xl border border-slate-100 flex flex-col transition-all hover:translate-y-[-10px] duration-500 relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-full h-2 bg-slate-200"></div>
                                        <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-6 bg-slate-100 px-4 py-1.5 rounded-full inline-block w-fit ring-1 ring-slate-200">Essential</div>
                                        <h5 className="text-3xl font-black text-brand-dark mb-2 tracking-tight">{plans.basic.name} Plan</h5>
                                        <p className="text-slate-500 font-bold text-sm mb-8">{plans.basic.description}</p>
                                        <div className="flex flex-col mb-10 p-6 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner">
                                            <div className="text-5xl font-black text-brand-dark">₹{formatPrice(plans.basic.price).monthly}<span className="text-lg text-slate-400 font-bold uppercase tracking-widest ml-1">/mo</span></div>
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mt-2 ml-1">Billed {plans.basic.price} Yearly</span>
                                        </div>
                                        
                                        <div className="space-y-5 mb-12 flex-grow">
                                            {plans.basic.features.filter(f => f.available).map((feature, i) => (
                                                <div key={i} className="flex items-center gap-4 text-sm font-bold text-slate-600">
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shadow-inner">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </div>
                                                    <span>{feature.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <Link to="/signup" className="block w-full text-center py-5 bg-brand-dark text-white font-black rounded-3xl hover:bg-black transition-all shadow-xl shadow-brand-dark/20 uppercase text-[10px] tracking-widest">Get Basic</Link>
                                    </div>
                                )}

                                {/* Pro Plan */}
                                {plans.pro && (
                                    <div className="bg-brand-dark p-12 rounded-[50px] shadow-[0_40px_100px_-20px_rgba(45,50,80,0.4)] border border-white/5 flex flex-col transition-all hover:translate-y-[-10px] duration-500 relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/20 blur-[80px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-brand-primary/30 transition-all duration-700"></div>
                                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-secondary/10 blur-[60px] rounded-full translate-y-1/2 -translate-x-1/2"></div>
                                        
                                        <div className="text-[11px] font-black text-brand-primary uppercase tracking-widest mb-6 bg-brand-primary/10 px-4 py-1.5 rounded-full inline-block w-fit ring-1 ring-brand-primary/20">Most Popular</div>
                                        <h5 className="text-3xl font-black text-white mb-2 tracking-tight">{plans.pro.name} Plan</h5>
                                        <p className="text-slate-400 font-bold text-sm mb-8">{plans.pro.description}</p>
                                        
                                        <div className="flex flex-col mb-10 p-6 bg-white/5 rounded-3xl border border-white/5 shadow-inner backdrop-blur-sm">
                                            <div className="text-5xl font-black text-brand-primary">₹{formatPrice(plans.pro.price).monthly}<span className="text-lg text-brand-light font-bold uppercase tracking-widest ml-1">/mo</span></div>
                                            <span className="text-[10px] font-black text-brand-light/60 uppercase tracking-[0.2em] mt-2 ml-1">Billed {plans.pro.price} Yearly</span>
                                        </div>
                                        
                                        <div className="space-y-5 mb-12 flex-grow">
                                            {plans.pro.features.filter(f => f.available).map((feature, i) => (
                                                <div key={i} className="flex items-center gap-3 text-sm font-bold text-slate-100">
                                                    <div className="w-6 h-6 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-primary shadow-sm group-hover:scale-110 transition-transform">
                                                        <CheckCircle2 className="w-4 h-4" />
                                                    </div>
                                                    <span>{feature.text}</span>
                                                </div>
                                            ))}
                                        </div>
                                        
                                        <Link to="/signup" className="block w-full text-center py-5 bg-brand-primary text-brand-dark font-black rounded-3xl shadow-2xl shadow-brand-primary/20 hover:scale-105 transition-all text-[10px] tracking-widest uppercase">Start Pro Trial</Link>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* Premium Footer */}
            <footer className="bg-white pt-32 pb-12 border-t border-slate-100 relative overflow-hidden">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -mr-48 -mt-48 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-secondary/5 rounded-full blur-[120px] -ml-48 -mb-48 pointer-events-none"></div>

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="grid lg:grid-cols-12 gap-16 mb-24">
                        {/* Brand Section */}
                        <div className="lg:col-span-4 space-y-10">
                            <div className="flex items-center gap-4 group cursor-pointer" onClick={() => navigate('/')}>
                                <div className="w-12 h-12 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden flex items-center justify-center p-1.5 transition-transform group-hover:scale-110">
                                    <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
                                </div>
                                <h1 className="text-2xl font-black text-brand-dark tracking-tighter uppercase">Lab <span className="text-brand-primary">Mitra</span></h1>
                            </div>
                            <p className="text-lg text-slate-500 font-bold leading-relaxed max-w-sm">
                                The definitive cloud infrastructure for modern diagnostic excellence. Precision synchronized across your entire clinical workflow.
                            </p>
                            <div className="flex gap-5">
                                {[
                                    { icon: <Globe className="w-5 h-5" />, href: "#" },
                                    { icon: <Zap className="w-5 h-5" />, href: "#" },
                                    { icon: <MessageCircle className="w-5 h-5" />, href: "#" },
                                    { icon: <Mail className="w-5 h-5" />, href: "#" }
                                ].map((social, i) => (
                                    <a key={i} href={social.href} className="w-11 h-11 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center border border-slate-100 hover:bg-brand-dark hover:text-white transition-all transform hover:-translate-y-1">
                                        {social.icon}
                                    </a>
                                ))}
                            </div>
                        </div>

                        {/* Link Columns */}
                        <div className="lg:col-span-5 grid grid-cols-2 md:grid-cols-3 gap-12">
                            <div className="space-y-8">
                                <h6 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-dark">Platform</h6>
                                <ul className="space-y-4 text-sm font-bold text-slate-400">
                                    <li><a href="#features" className="hover:text-brand-primary transition-colors flex items-center gap-2">Features</a></li>
                                    <li><a href="#pricing" className="hover:text-brand-primary transition-colors flex items-center gap-2">Pricing Plans</a></li>
                                    <li><a href="#stats" className="hover:text-brand-primary transition-colors flex items-center gap-2">Global Impact</a></li>
                                    <li><a href="#" className="hover:text-brand-primary transition-colors flex items-center gap-2">API Documentation</a></li>
                                </ul>
                            </div>
                            <div className="space-y-8">
                                <h6 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-dark">Company</h6>
                                <ul className="space-y-4 text-sm font-bold text-slate-400">
                                    <li><Link to="/about" className="hover:text-brand-primary transition-colors">Our Mission</Link></li>
                                    <li><a href="#" className="hover:text-brand-primary transition-colors">Careers</a></li>
                                    <li><a href="#" className="hover:text-brand-primary transition-colors">Newsroom</a></li>
                                    <li><a href="#" className="hover:text-brand-primary transition-colors">Contact Support</a></li>
                                </ul>
                            </div>
                            <div className="space-y-8 col-span-2 md:col-span-1">
                                <h6 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-dark">Legal</h6>
                                <ul className="space-y-4 text-sm font-bold text-slate-400">
                                    <li><a href="#" className="hover:text-brand-primary transition-colors">Privacy Policy</a></li>
                                    <li><a href="#" className="hover:text-brand-primary transition-colors">Terms of Service</a></li>
                                    <li><a href="#" className="hover:text-brand-primary transition-colors">Cookie Policy</a></li>
                                </ul>
                            </div>
                        </div>

                        {/* Newsletter Section */}
                        <div className="lg:col-span-3 space-y-8">
                            <h6 className="text-[10px] font-black uppercase tracking-[0.4em] text-brand-dark">Stay Updated</h6>
                            <p className="text-sm font-bold text-slate-500 leading-relaxed">
                                Join our monthly briefing on clinical technology and lab management.
                            </p>
                            <div className="relative group">
                                <input 
                                    type="email" 
                                    placeholder="Enter your email"
                                    className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-sm font-bold outline-none focus:bg-white focus:border-brand-primary transition-all pr-14"
                                />
                                <button className="absolute right-2 top-2 bottom-2 w-10 h-10 bg-brand-dark text-white rounded-xl flex items-center justify-center hover:bg-brand-primary transition-colors active:scale-95">
                                    <Send className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex items-center gap-3 text-xs font-black uppercase tracking-widest text-slate-400 pt-4">
                                <Globe className="w-4 h-4 text-brand-primary" />
                                <span>Based in Muskara, UP</span>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Bar */}
                    <div className="pt-12 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">
                            © 2026 LabMitra Global Healthcare. All Rights Reserved.
                        </p>
                        <div className="flex items-center gap-3 bg-slate-50 px-5 py-2 rounded-full border border-slate-100">
                            <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></span>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Global Infrastructure Live</span>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default Home;
