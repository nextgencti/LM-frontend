import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { Lock, Mail, AlertCircle, Loader, ChevronRight, ArrowLeft } from 'lucide-react';
import PreLoader from '../components/PreLoader';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { currentUser, loading: authLoading } = useAuth();
  
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && currentUser) {
      navigate('/dashboard');
    }
  }, [currentUser, authLoading, navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      setIsLoading(false); // Stop login loading
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError('Invalid email or password. Please try again.');
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <PreLoader message="Verifying Cloud Identity..." />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-6 overflow-hidden relative">
      
      {/* Decorative Brand Background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -mr-48 -mt-48"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-secondary/5 rounded-full blur-[120px] -ml-48 -mb-48"></div>
      
      <div className="max-w-sm w-full p-6 sm:p-8 bg-white rounded-3xl sm:rounded-[36px] shadow-[0_32px_128px_rgba(0,0,0,0.4)] relative z-10 border border-white/10 animate-in fade-in zoom-in duration-700">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden flex items-center justify-center p-2.5 mx-auto mb-4 rotate-3 transition-transform hover:rotate-6">
            <img src="/favicon.png" alt="LabMitra Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-3xl font-black text-brand-dark tracking-tighter uppercase mb-1.5">
            Lab <span className="text-brand-primary">Mitra</span>
          </h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clinical Command Terminal</p>
        </div>

        {error && (
          <div className="mb-8 bg-rose-50 border border-rose-100 p-4 rounded-[22px] flex items-start animate-in slide-in-from-top-4 duration-300">
            <AlertCircle className="w-5 h-5 text-rose-500 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] font-black text-rose-700 uppercase tracking-wide leading-relaxed">{error}</p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <Label>Identity (Email)</Label>
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 w-full pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all placeholder:text-slate-400 shadow-inner"
                placeholder="admin@catalog.io"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Access Key (Password)</label>
            </div>
            <div className="relative group mb-2.5">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10 w-full pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all placeholder:text-slate-400 shadow-inner"
                placeholder="••••••••"
              />
            </div>
            <Link to="/forgot-password" className="inline-block text-[10px] font-bold uppercase tracking-wider text-brand-primary hover:underline ml-1">Forgot Password?</Link>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center py-3.5 px-6 border-none rounded-2xl shadow-lg shadow-brand-dark/20 text-[11px] font-bold uppercase tracking-wider text-white bg-brand-dark hover:bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] group"
          >
            {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : (
              <span className="flex items-center gap-2">
                Authorize Access <ChevronRight className="w-3.5 h-3.5 text-brand-primary group-hover:translate-x-1 transition-transform" />
              </span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center space-y-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                Don't have a lab account? <Link to="/signup" className="text-brand-primary hover:underline underline-offset-4 ml-1.5">Register Your Lab</Link>
            </p>
            <Link 
              to="/" 
              className="inline-flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-wider hover:text-brand-primary transition-colors group"
            >
              <ArrowLeft className="w-2.5 h-2.5 group-hover:-translate-x-1 transition-transform" />
              Back to Home
            </Link>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-50 text-center">
           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-loose">
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
  <label className="block text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider ml-1">{children}</label>
);
// Primitives used above

export default Login;
