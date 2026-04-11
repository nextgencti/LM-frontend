import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader, AlertTriangle } from 'lucide-react';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, userData, subscription, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Check Auth
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Check role
  if (allowedRoles && userData && !allowedRoles.includes(userData.role)) {
    // For SuperAdmins, if they land on a page that requires a lab context but haven't selected one
    // we let them through to the page, but the page handles the "No Lab Selected" state.
    // However, if the page is strictly for LabAdmin/Staff and NOT SuperAdmin, we still deny.
    // (We updated App.jsx to include SuperAdmin in allowedRoles for most pages).
    
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
