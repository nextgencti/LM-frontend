import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, AlertCircle, Loader, ChevronRight, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-toastify';

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP & New Password, 3: Success
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      await axios.post(`${BACKEND_URL}/api/auth/forgot-password/send-otp`, { email });
      toast.success('OTP sent successfully to your email!');
      setStep(2);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to send OTP. Please check the email address.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    
    if (newPassword.length < 6) {
        setError("Password must be at least 6 characters long.");
        return;
    }

    if (newPassword !== confirmPassword) {
        setError("Passwords do not match.");
        return;
    }

    setIsLoading(true);

    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      await axios.post(`${BACKEND_URL}/api/auth/forgot-password/reset`, { 
          email, 
          otp, 
          newPassword 
      });
      setStep(3);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to reset password. Invalid OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-dark p-6 overflow-hidden relative">
      
      {/* Decorative Brand Background */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/5 rounded-full blur-[120px] -mr-48 -mt-48"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-brand-secondary/5 rounded-full blur-[120px] -ml-48 -mb-48"></div>
      
      <div className="max-w-md w-full p-6 sm:p-10 bg-white rounded-[32px] sm:rounded-[42px] shadow-[0_32px_128px_rgba(0,0,0,0.4)] relative z-10 border border-white/10 animate-in fade-in zoom-in duration-700">
        
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-white rounded-[24px] shadow-xl border border-slate-100 overflow-hidden flex items-center justify-center p-3 mx-auto mb-6 rotate-3 transition-transform hover:rotate-6">
            <KeyRound className="w-8 h-8 text-brand-primary" />
          </div>
          <h2 className="text-3xl font-black text-brand-dark tracking-tighter uppercase mb-2">
            Reset Password
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
            {step === 1 && "Enter your email to receive a verification code"}
            {step === 2 && "Enter the OTP sent to your email"}
            {step === 3 && "Password updated successfully"}
          </p>
        </div>

        {error && (
          <div className="mb-8 bg-rose-50 border border-rose-100 p-4 rounded-[22px] flex items-start animate-in slide-in-from-top-4 duration-300">
            <AlertCircle className="w-5 h-5 text-rose-500 mr-3 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] font-black text-rose-700 uppercase tracking-wide leading-relaxed">{error}</p>
          </div>
        )}

        {step === 1 && (
            <form onSubmit={handleSendOtp} className="space-y-8 animate-in fade-in slide-in-from-right-4">
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

            <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center py-5 px-6 border-none rounded-[24px] shadow-xl shadow-brand-dark/20 text-[11px] font-black uppercase tracking-[0.3em] text-white bg-brand-dark hover:bg-brand-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] group"
            >
                {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : (
                <span className="flex items-center gap-3">
                    Send OTP <ChevronRight className="w-4 h-4 text-brand-primary group-hover:translate-x-1 transition-transform" />
                </span>
                )}
            </button>
            </form>
        )}

        {step === 2 && (
            <form onSubmit={handleResetPassword} className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
                <Label>Verification Code (OTP)</Label>
                <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    className="text-center tracking-[1em] font-black text-2xl w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-[24px] text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all placeholder:text-slate-300 shadow-inner"
                    placeholder="••••••"
                />
            </div>

            <div>
                <Label>New Password</Label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                        <KeyRound className="h-5 w-5 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
                    </div>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        className="pl-14 w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-[24px] text-sm font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all placeholder:text-slate-300 shadow-inner"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <div>
                <Label>Confirm Password</Label>
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                        <KeyRound className="h-5 w-5 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
                    </div>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className="pl-14 w-full px-6 py-4.5 bg-slate-50 border border-slate-100 rounded-[24px] text-sm font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 focus:bg-white transition-all placeholder:text-slate-300 shadow-inner"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center py-5 px-6 mt-4 border-none rounded-[24px] shadow-xl shadow-brand-primary/30 text-[11px] font-black uppercase tracking-[0.3em] text-brand-dark bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] group"
            >
                {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : (
                <span className="flex items-center gap-3">
                    Reset Password <ChevronRight className="w-4 h-4 text-brand-dark group-hover:translate-x-1 transition-transform" />
                </span>
                )}
            </button>
            </form>
        )}

        {step === 3 && (
            <div className="text-center animate-in zoom-in duration-500">
                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                </div>
                <h3 className="text-xl font-black text-brand-dark mb-4">Password Reset Complete</h3>
                <p className="text-sm text-slate-500 mb-8 font-medium">You can now login with your new password.</p>
                <Link
                    to="/login"
                    className="w-full inline-flex items-center justify-center py-5 px-6 border-none rounded-[24px] shadow-xl shadow-brand-dark/20 text-[11px] font-black uppercase tracking-[0.3em] text-white bg-brand-dark hover:bg-brand-secondary transition-all active:scale-[0.98]"
                >
                    Return to Login
                </Link>
            </div>
        )}

        {step !== 3 && (
            <div className="mt-8 text-center space-y-4">
                <Link 
                to="/login" 
                className="inline-flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] hover:text-brand-primary transition-colors group"
                >
                <ArrowLeft className="w-3 h-3 group-hover:-translate-x-1 transition-transform" />
                Back to Login
                </Link>
            </div>
        )}
      </div>
    </div>
  );
};

const Label = ({ children }) => (
  <label className="block text-[9px] font-black text-slate-400 mb-2.5 uppercase tracking-[0.2em] ml-2">{children}</label>
);

export default ForgotPassword;
