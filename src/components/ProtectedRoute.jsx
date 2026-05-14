import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PreLoader from './PreLoader';
import { AlertTriangle, Sparkles, Clock, Mail, ArrowRight } from 'lucide-react';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userData, subscription, loading, isDemoLab, demoDaysRemaining, demoExpiryDate } = useAuth();

  if (loading) {
    return <PreLoader message="Securing Session Context" />;
  }

  // Check Auth
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Check role
  if (allowedRoles && userData && !allowedRoles.includes(userData.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center bg-white p-8 rounded-lg shadow-md max-w-md">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You do not have permission to access this page.</p>
          <button onClick={() => window.history.back()} className="text-blue-600 hover:underline">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Check Subscription for non-SuperAdmin
  if (userData?.role !== 'SuperAdmin') {
    const today = new Date().toISOString().split('T')[0];
    const isExpired = subscription?.status === 'expired' || (subscription?.expiryDate && subscription.expiryDate < today);

    if (!subscription || isExpired) {
      // Demo-specific paywall
      if (isDemoLab || subscription?.plan === 'demo') {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-50 p-4 font-sans">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-200/20 rounded-full blur-[120px]"></div>
              <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-brand-primary/10 rounded-full blur-[120px]"></div>
            </div>

            <div className="max-w-lg w-full relative z-10">
              <div className="bg-white rounded-[40px] shadow-[0_32px_128px_rgba(0,0,0,0.06)] border border-slate-100 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-10 py-10 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23fff\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M0 0h20v20H0zM20 20h20v20H20z\'/%3E%3C/g%3E%3C/svg%3E')]"></div>
                  <div className="relative z-10">
                    <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-[24px] flex items-center justify-center mx-auto mb-5 border border-white/20 rotate-6">
                      <Clock className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase mb-2">Demo Expired</h2>
                    <p className="text-violet-200 text-sm font-bold">Your free trial period has ended</p>
                  </div>
                </div>

                {/* Body */}
                <div className="px-10 py-10">
                  <div className="bg-violet-50 border border-violet-100 rounded-[24px] p-6 mb-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-violet-900 uppercase tracking-tight mb-1">Your Data is Safe</h3>
                        <p className="text-xs text-violet-600 leading-relaxed">
                          All your lab data, patients, reports, and configurations are securely preserved. 
                          Simply subscribe to a plan to regain instant access.
                        </p>
                      </div>
                    </div>
                  </div>

                  {subscription?.expiryDate && (
                    <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-5 py-3 mb-6 border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Demo Ended</span>
                      <span className="text-sm font-black text-rose-500">{new Date(subscription.expiryDate).toLocaleDateString('en-GB')}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <button 
                      onClick={() => window.location.href = 'mailto:support@labmitra.com?subject=Subscription%20Purchase%20-%20Demo%20Expired'}
                      className="w-full flex items-center justify-center gap-3 py-5 bg-gradient-to-r from-violet-600 to-purple-700 text-white rounded-[20px] font-black uppercase text-[11px] tracking-[0.2em] shadow-xl shadow-violet-600/20 hover:shadow-2xl hover:shadow-violet-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Mail className="w-4 h-4" />
                      Purchase Subscription
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-2">
                      Contact support@labmitra.com for plans & pricing
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.4em]">
                  Lab Mitra • Cloud Diagnostics Platform
                </p>
              </div>
            </div>
          </div>
        );
      }

      // Regular subscription expired paywall (non-demo)
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-red-100 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Subscription Expired</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              {subscription?.expiryDate 
                ? `Your lab's subscription expired on ${new Date(subscription.expiryDate).toLocaleDateString('en-GB')}.` 
                : "Your lab does not have an active subscription."}
              {" "}Please contact support or your laboratory administrator to renew your plan.
            </p>
            <button 
              onClick={() => window.location.href = 'mailto:support@labmitra.com'}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
            >
              Contact Support
            </button>
          </div>
        </div>
      );
    }
  }

  return children;
};
