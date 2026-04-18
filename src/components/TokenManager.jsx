import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Zap, PlusCircle, Clock, AlertCircle, Loader } from 'lucide-react';
import { toast } from 'react-toastify';

const TokenManager = () => {
  const { userData, subscription, currentUser, activeLabId } = useAuth();
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestAmount, setRequestAmount] = useState('100');
  const [loading, setLoading] = useState(false);

  // Only show for token-based plans or specific labs
  if (subscription?.plan !== 'pay_as_you_go') return null;

  const handleRequestTokens = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const token = await currentUser.getIdToken();
      
      const response = await fetch(`${BACKEND_URL}/api/tokens/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requestedAmount: requestAmount })
      });
      
      const data = await response.json();
      if (response.ok) {
        toast.success("Token request sent to Super Admin!");
        setIsRequesting(false);
      } else {
        toast.error(data.error || "Failed to send request");
      }
    } catch (error) {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 mx-4 p-4 bg-amber-50 rounded-2xl border border-amber-100 shadow-sm animate-in slide-in-from-bottom duration-500">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div>
            <p className="text-[10px] font-black text-amber-600/60 uppercase tracking-widest leading-none">Token Balance</p>
            <p className="text-xl font-black text-amber-700 tabular-nums">
              {subscription?.tokenBalance || 0}
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => setIsRequesting(!isRequesting)}
          className="p-2 bg-white text-amber-600 rounded-xl border border-amber-200 hover:shadow-md transition-all active:scale-95"
          title="Buy/Request Tokens"
        >
          <PlusCircle className="w-5 h-5" />
        </button>
      </div>

      {isRequesting && (
        <form onSubmit={handleRequestTokens} className="mt-4 p-3 bg-white rounded-xl border border-amber-100 animate-in zoom-in-95 duration-200">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2">Request Tokens</label>
          <div className="flex gap-2">
            <input 
              type="number" 
              value={requestAmount}
              onChange={(e) => setRequestAmount(e.target.value)}
              className="flex-grow bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-200"
              placeholder="Qty"
            />
            <button 
              disabled={loading}
              className="px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-black uppercase tracking-tighter hover:bg-amber-600 transition-colors flex items-center gap-2"
            >
              {loading ? <Loader className="w-3 h-3 animate-spin" /> : 'Send'}
            </button>
          </div>
          <p className="text-[8px] text-slate-400 mt-2 italic px-1">SuperAdmin will verify and add tokens manually.</p>
        </form>
      )}

      {(subscription?.tokenBalance || 0) < 50 && (
        <div className="mt-3 flex items-center gap-2 px-2 py-1.5 bg-red-50 text-red-500 rounded-lg border border-red-100">
          <AlertCircle className="w-3 h-3" />
          <span className="text-[9px] font-black uppercase tracking-tight">Low Balance Notice</span>
        </div>
      )}
    </div>
  );
};

export default TokenManager;
