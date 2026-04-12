import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Activity, Shield, Zap, Globe, Users, Target, Rocket, ArrowLeft, ChevronRight, Mail, Phone, MapPin } from 'lucide-react';

const AboutUs = () => {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const coreValues = [
        {
            icon: <Target className="w-8 h-8 text-brand-primary" />,
            title: "Uncompromising Precision",
            desc: "Every report carries a life-impacting decision. We build systems that eliminate human error and ensure surgical accuracy in clinical data."
        },
        {
            icon: <Shield className="w-8 h-8 text-blue-500" />,
            title: "Data Integrity",
            desc: "Patient privacy is not a feature; it's our foundation. We employ bank-grade encryption to protect the most sensitive clinical information."
        },
        {
            icon: <Rocket className="w-8 h-8 text-amber-500" />,
            title: "Innovation-First",
            desc: "Healthcare is evolving, and so are we. Our cloud-sync technology ensures that even the most remote labs can operate at global standards."
        }
    ];

    const stats = [
        { label: "Active Laboratories", value: "500+" },
        { label: "Daily Reports", value: "25k+" },
        { label: "Uptime", value: "99.99%" },
        { label: "Technical Support", value: "24/7" }
    ];

    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-brand-primary/30 selection:text-brand-dark">
            
            {/* Simple Navigation */}
            <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'py-4 bg-white/80 backdrop-blur-xl shadow-lg border-b border-slate-100' : 'py-6 bg-transparent'}`}>
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-3 group text-slate-500 hover:text-brand-dark transition-all">
                        <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-brand-dark group-hover:text-white transition-all">
                            <ArrowLeft className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-black uppercase tracking-widest hidden sm:block">Back</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-xl shadow-md border border-slate-100 overflow-hidden flex items-center justify-center p-1">
                            <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
                        </div>
                        <h1 className="text-xl font-black tracking-tighter uppercase text-brand-dark">Lab <span className="text-brand-primary">Mitra</span></h1>
                    </div>

                    <Link to="/login" className="px-6 py-3 bg-brand-dark text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-brand-dark/20 hover:scale-105 active:scale-95 transition-all">
                        Sign In
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-48 pb-32 overflow-hidden bg-slate-50">
                <div className="absolute top-0 right-0 -z-10 w-2/3 h-full bg-brand-primary/5 blur-[120px] rounded-full translate-x-1/2 -translate-y-1/2"></div>
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <div className="inline-flex items-center gap-2 bg-white px-5 py-2 rounded-full border border-slate-200 mb-8 animate-in fade-in slide-in-from-bottom duration-700">
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-brand-primary">Corporate Profile</span>
                    </div>
                    <h2 className="text-5xl md:text-7xl font-black text-brand-dark leading-[1.1] tracking-tighter mb-8 animate-in fade-in slide-in-from-bottom duration-1000">
                        Empowering the world's <br />
                        <span className="text-brand-primary italic">Clinical Precision.</span>
                    </h2>
                    <p className="max-w-2xl mx-auto text-xl text-slate-500 font-bold leading-relaxed mb-12 animate-in fade-in duration-1000 delay-300">
                        LabMitra is a mission-driven technology platform dedicated to modernizing pathology laboratory infrastructure through intelligent cloud-sync solutions.
                    </p>
                    <div className="flex justify-center gap-4 animate-in fade-in zoom-in duration-700 delay-500">
                        <div className="w-16 h-1 bg-brand-primary rounded-full"></div>
                        <div className="w-4 h-1 bg-brand-dark rounded-full"></div>
                    </div>
                </div>
            </section>

            {/* Detailed Mission */}
            <section className="py-32">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid lg:grid-cols-2 gap-20 items-center">
                        <div className="space-y-10">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-4">The Vision</h3>
                                <h2 className="text-4xl font-black text-brand-dark leading-tight tracking-tight">
                                    Why LabMitra exists in <br />
                                    modern diagnostics.
                                </h2>
                            </div>
                            <p className="text-lg text-slate-600 font-bold leading-loose">
                                We believe that diagnostic accuracy should not be limited by geographic boundaries. Our platform bridges the gap between sophisticated laboratory science and accessible technology, providing pathologists with the tools they need to manage complex clinical workflows seamlessly.
                            </p>
                            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                                {stats.map((s, i) => (
                                    <div key={i} className="flex flex-col">
                                        <span className="text-3xl font-black text-brand-dark tracking-tighter mb-1">{s.value}</span>
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="relative">
                            <div className="absolute -inset-4 bg-brand-primary/10 rounded-[48px] rotate-3 -z-10 animate-float"></div>
                            <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 p-8 md:p-12 overflow-hidden relative">
                                <Activity className="absolute -right-12 -top-12 w-48 h-48 text-slate-50 opacity-5" />
                                <div className="space-y-12">
                                    {coreValues.map((v, i) => (
                                        <div key={i} className="flex gap-6 group">
                                            <div className="shrink-0 p-4 bg-slate-50 rounded-2xl group-hover:bg-brand-primary/10 group-hover:scale-110 transition-all duration-500">
                                                {v.icon}
                                            </div>
                                            <div>
                                                <h4 className="text-xl font-black text-brand-dark mb-2">{v.title}</h4>
                                                <p className="text-sm text-slate-500 font-bold leading-relaxed">{v.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Our Story / Technical Edge */}
            <section className="py-32 bg-brand-dark text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-brand-primary/10 blur-[150px] rounded-full translate-x-1/2"></div>
                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="max-w-3xl">
                        <h3 className="text-brand-primary font-black uppercase tracking-[0.4em] text-sm mb-6">Technical Infrastructure</h3>
                        <h2 className="text-4xl md:text-5xl font-black text-white leading-tight tracking-tight mb-10">
                            Cloud-Native foundation for <br />
                            high-stakes diagnostics.
                        </h2>
                        <div className="grid md:grid-cols-2 gap-12 text-slate-400 text-sm font-bold leading-loose">
                            <p>
                                Our architecture is built to handle the rigorous demands of clinical environments. With real-time synchronization between offline desktops and our global cloud, we ensure that no patient data is ever lost.
                            </p>
                            <p>
                                We prioritize security at every layer. From ISO-compliant data handling to encrypted PDF generation, LabMitra is the trusted partner for laboratories looking to scale securely.
                            </p>
                        </div>
                        <div className="mt-16 flex flex-wrap gap-8 items-center border-t border-white/5 pt-12">
                            <div className="flex items-center gap-3">
                                <Shield className="w-5 h-5 text-brand-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">ISO 27001 Ready</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Zap className="w-5 h-5 text-brand-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Real-time Sync</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <Globe className="w-5 h-5 text-brand-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Global Infrastructure</span>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Call to action footer */}
            <footer className="py-32 bg-slate-50">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <h2 className="text-3xl font-black text-brand-dark mb-10 tracking-tight uppercase">Ready to modernize your lab?</h2>
                    <div className="flex justify-center gap-6">
                        <Link to="/signup" className="px-10 py-5 bg-brand-primary text-brand-dark font-black rounded-3xl shadow-2xl shadow-brand-primary/20 hover:scale-105 transition-all uppercase text-[11px] tracking-widest">
                            Join Now
                        </Link>
                        <button className="px-10 py-5 bg-white border-2 border-slate-100 text-brand-dark font-black rounded-3xl hover:bg-slate-50 transition-all uppercase text-[11px] tracking-widest">
                             Contact Sales
                        </button>
                    </div>
                    <div className="mt-24 pt-10 border-t border-slate-200">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">© 2026 LabMitra Global Healthcare Systems.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default AboutUs;
