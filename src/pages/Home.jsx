import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, Zap, Shield, FileText, Globe, CheckCircle2, Menu, X, ArrowRight, Star, Heart, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Home = () => {
    const { currentUser, userData } = useAuth();
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
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
                        <div className="p-2.5 bg-brand-dark rounded-2xl shadow-xl shadow-brand-dark/20 transform group-hover:rotate-12 transition-transform">
                            <Activity className="w-6 h-6 text-brand-primary" />
                        </div>
                        <h1 className="text-2xl font-black tracking-tighter uppercase text-brand-dark">Lab Mitra</h1>
                    </div>

                    <div className="hidden md:flex items-center gap-8 text-[13px] font-black uppercase tracking-widest text-slate-500">
                        <a href="#features" className="hover:text-brand-primary transition-colors">Features</a>
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
                <div className="fixed inset-0 z-40 bg-white/95 backdrop-blur-3xl md:hidden pt-32 px-10 animate-in fade-in slide-in-from-top-10 duration-500">
                    <div className="flex flex-col gap-8 text-2xl font-black uppercase tracking-widest">
                        <a href="#features" onClick={() => setMobileMenuOpen(false)}>Features</a>
                        <a href="#stats" onClick={() => setMobileMenuOpen(false)}>Stats</a>
                        <Link to="/login" onClick={() => setMobileMenuOpen(false)}>Login</Link>
                        <Link to="/login" className="text-brand-primary" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
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
                        <h2 className="text-5xl md:text-7xl font-black text-brand-dark leading-[1.05] tracking-tighter mb-8">
                            Pathology <span className="text-brand-primary italic">Simplified.</span> <br />
                            Precision <span className="text-brand-secondary">Guaranteed.</span>
                        </h2>
                        <p className="text-xl text-slate-500 font-bold leading-relaxed mb-10 max-w-xl">
                            The all-in-one cloud platform designed for modern laboratories. From booking to reporting, manage your entire pathology workflow with surgical precision.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <Link to="/signup" className="px-10 py-5 bg-brand-dark text-white text-lg font-black rounded-[28px] shadow-2xl shadow-brand-dark/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                                Start Free Trial <ArrowRight className="w-5 h-5" />
                            </Link>
                            <button className="px-10 py-5 bg-white border-2 border-slate-100 text-brand-dark text-lg font-black rounded-[28px] shadow-lg hover:bg-slate-50 transition-all">
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

            {/* Pricing Section (Mini) */}
            <section className="py-32 bg-white">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="bg-brand-light/30 rounded-[60px] p-12 md:p-24 flex flex-col md:flex-row items-center justify-between gap-12 overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/20 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
                        <div className="z-10 max-w-xl text-center md:text-left">
                            <h2 className="text-4xl md:text-5xl font-black text-brand-dark mb-6 tracking-tight leading-tight">Ready to modernize your pathology lab?</h2>
                            <p className="text-lg text-brand-secondary font-bold mb-10 leading-relaxed">Join hundreds of laboratories migrating to a smarter, faster, and more secure cloud ecosystem.</p>
                            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                                <Link to="/login" className="px-10 py-5 bg-brand-dark text-white font-black rounded-[28px] shadow-2xl shadow-brand-dark/30 hover:scale-105 active:scale-95 transition-all">Get Started Now</Link>
                                <button className="px-10 py-5 bg-white border border-brand-primary/20 text-brand-dark font-black rounded-[28px] shadow-lg flex items-center gap-2">Talk to Sales <Star className="w-5 h-5 text-brand-primary" /></button>
                            </div>
                        </div>
                        <div className="z-10 bg-white p-10 rounded-[48px] shadow-2xl border border-brand-primary/20 w-full max-w-sm transform hover:rotate-2 transition-transform duration-500">
                            <div className="text-[11px] font-black text-brand-primary uppercase tracking-widest mb-6 bg-brand-primary/10 px-4 py-1.5 rounded-full inline-block">Popular Choice</div>
                            <h5 className="text-2xl font-black text-brand-dark mb-2 tracking-tight">Pro Plan</h5>
                            <div className="text-4xl font-black text-brand-dark mb-8">₹2,499<span className="text-lg text-slate-400 font-bold lowercase">/month</span></div>
                            <div className="space-y-4 mb-10">
                                {["Multi-lab Management", "Automated PDF Reporting", "WhatsApp & Email Integration", "Advanced Analytics Dashboard"].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 text-sm font-bold text-slate-600">
                                        <CheckCircle2 className="w-5 h-5 text-brand-primary shrink-0" />
                                        <span>{item}</span>
                                    </div>
                                ))}
                            </div>
                            <Link to="/login" className="block w-full text-center py-4 bg-brand-primary/10 text-brand-dark font-black rounded-2xl hover:bg-brand-primary hover:text-white transition-all">Select Plan</Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-50 py-20 border-t border-slate-100 overflow-hidden relative">
                <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-16 relative z-10 font-bold">
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-brand-dark rounded-xl"><Activity className="w-5 h-5 text-brand-primary" /></div>
                            <h1 className="text-xl font-black tracking-tighter uppercase text-brand-dark">Lab Mitra</h1>
                        </div>
                        <p className="text-sm text-slate-500 leading-loose pr-8">
                            Empowering pathology laboratories with cutting-edge cloud infrastructure and real-time clinical workflows.
                        </p>
                    </div>
                    <div className="flex flex-col gap-6">
                        <h6 className="text-brand-dark uppercase tracking-widest text-xs font-black">Platform</h6>
                        <ul className="space-y-4 text-sm text-slate-500">
                            <li><a href="#" className="hover:text-brand-primary transition-colors">Features</a></li>
                            <li><a href="#" className="hover:text-brand-primary transition-colors">Integration</a></li>
                            <li><a href="#" className="hover:text-brand-primary transition-colors">Security</a></li>
                            <li><a href="#" className="hover:text-brand-primary transition-colors">Cloud Sync</a></li>
                        </ul>
                    </div>
                    <div className="flex flex-col gap-6">
                        <h6 className="text-brand-dark uppercase tracking-widest text-xs font-black">Company</h6>
                        <ul className="space-y-4 text-sm text-slate-500">
                            <li><a href="#" className="hover:text-brand-primary transition-colors">About Us</a></li>
                            <li><a href="#" className="hover:text-brand-primary transition-colors">Contact</a></li>
                            <li><a href="#" className="hover:text-brand-primary transition-colors">Privacy Policy</a></li>
                            <li><a href="#" className="hover:text-brand-primary transition-colors">Terms of Service</a></li>
                        </ul>
                    </div>
                    <div className="flex flex-col gap-6">
                        <h6 className="text-brand-dark uppercase tracking-widest text-xs font-black">Contact Info</h6>
                        <ul className="space-y-4 text-sm text-slate-500">
                            <li className="flex items-center gap-3"><Globe className="w-4 h-4 text-brand-primary" /> muskara, Uttar Pradesh</li>
                            <li className="flex items-center gap-3"><Clock className="w-4 h-4 text-brand-primary" /> 24x7 Customer Support</li>
                        </ul>
                    </div>
                </div>
                <div className="max-w-7xl mx-auto px-6 mt-20 pt-10 border-t border-slate-200 text-center relative z-10">
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">© 2026 Lab Mitra. Built with Precision.</p>
                </div>
            </footer>
        </div>
    );
};

export default Home;
