import React from 'react';
import { Loader } from 'lucide-react';

const PreLoader = ({ message = "Initialising System" }) => {
    return (
        <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[9999] overflow-hidden">
            {/* Background Accents */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -mr-48 -mt-48"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-secondary/5 rounded-full blur-[120px] -ml-48 -mb-48"></div>

            <div className="relative flex flex-col items-center">
                {/* Pulsing Logo Container */}
                <div className="relative mb-12">
                    <div className="absolute inset-0 bg-brand-primary/20 rounded-3xl blur-2xl animate-pulse"></div>
                    <div className="relative w-24 h-24 bg-white rounded-3xl shadow-2xl border border-slate-100 p-4 animate-in zoom-in duration-700">
                        <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain animate-pulse" />
                    </div>
                </div>

                {/* Loading Text & Spinner */}
                <div className="flex flex-col items-center gap-4 text-center">
                    <h2 className="text-[12px] font-black uppercase tracking-[0.4em] text-brand-dark animate-pulse">
                        Lab <span className="text-brand-primary">Mitra</span>
                    </h2>
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1.5">
                            {[0, 150, 300].map((delay) => (
                                <div 
                                    key={delay}
                                    className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-bounce"
                                    style={{ animationDelay: `${delay}ms` }}
                                ></div>
                            ))}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            {message}
                        </span>
                    </div>
                </div>

                {/* Progress Indicator (Decorative) */}
                <div className="mt-16 w-48 h-1 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                    <div className="h-full bg-brand-secondary/40 w-1/3 rounded-full animate-slide-infinite"></div>
                </div>
            </div>

            <style>{`
                @keyframes slide-infinite {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(300%); }
                }
                .animate-slide-infinite {
                    animation: slide-infinite 2s infinite ease-in-out;
                }
            `}</style>
        </div>
    );
};

export default PreLoader;
