import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, AlertCircle, Loader } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Wait for auth context to fetch role and subscription...
      // but essentially AuthContext handles token caching.
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError('Invalid email or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-6 overflow-hidden relative">
      
      {/* Decorative Brand Background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -mr-48 -mt-48"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-secondary/5 rounded-full blur-[120px] -ml-48 -mb-48"></div>
      
      <div className="max-w-md w-full p-10 bg-white rounded-[42px] shadow-[0_32px_128px_rgba(0,0,0,0.4)] relative z-10 border border-white/10 animate-in fade-in zoom-in duration-700">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-brand-light rounded-[28px] flex items-center justify-center mx-auto mb-6 shadow-sm border border-brand-primary/10 rotate-3 transition-transform hover:rotate-6">
             <Lock className="w-10 h-10 text-brand-primary" />
          </div>
          <h2 className="text-4xl font-black text-brand-dark tracking-tighter uppercase mb-2">
            Patho<span className="text-brand-primary/80">SaaS</span>
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Clinical Command Terminal</p>
        </div>

        {error && (
          <div className="mb-8 bg-rose-50 border border-rose-100 p-4 rounded-[22px] flex items-start animate-in slide-in-from-top-4 duration-300">
            <AlertCircle className="w-5 h-5 text-rose-500 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] font-black text-rose-700 uppercase tracking-wide leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-8">
          <div>
            <Label>Identity (Email)</Label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-14 w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-[24px] text-sm font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all placeholder:text-slate-300 shadow-inner"
                placeholder="admin@catalog.io"
              />
            </div>
          </div>

          <div>
            <Label>Access Key (Password)</Label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-14 w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-[24px] text-sm font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all placeholder:text-slate-300 shadow-inner"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center py-5 px-6 border-none rounded-[24px] shadow-xl shadow-brand-dark/20 text-[11px] font-black uppercase tracking-[0.3em] text-white bg-brand-dark hover:bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] group"
          >
            {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : (
              <span className="flex items-center gap-3">
                Authorize Access <ChevronRight className="w-4 h-4 text-brand-primary group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </button>
        </form>

        <div className="mt-12 pt-8 border-t border-slate-50 text-center">
           <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-loose">
             &copy; 2026 Lab Mitra v4.0.0 <br/>
             Authorized Personnel Only
           </p>
        </div>
      </div>
    </div>
  );
};

/* ─── Primitives for Login ───────────────────────────────────────────── */
const Label = ({ children }) => (
  <label className="block text-[9px] font-black text-slate-400 mb-2.5 uppercase tracking-[0.2em] ml-2">{children}</label>
);
// Import ChevronRight for the button link style if not already present
import { ChevronRight } from 'lucide-react';

export default Login;
