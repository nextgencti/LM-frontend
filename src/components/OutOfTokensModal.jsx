import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { Zap, Loader } from 'lucide-react';
import { toast } from 'react-toastify';

const OutOfTokensModal = ({ isOpen, onClose }) => {
  const { currentUser, userData } = useAuth();
  const [requesting, setRequesting] = useState(false);
  const [requestedAmount, setRequestedAmount] = useState(100);

  const handleRequestTokens = async () => {
    setRequesting(true);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const token = await currentUser.getIdToken();
      
      const response = await fetch(`${BACKEND_URL}/api/tokens/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          requestedAmount: parseInt(requestedAmount),
          adminName: userData?.name || 'Admin',
          adminEmail: userData?.email || 'N/A',
          adminPhone: userData?.mobile || userData?.phone || 'N/A'
        })
      });
      
      if (response.ok) {
        toast.success(`Request for ${requestedAmount} tokens sent!`);
        onClose();
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to send request");
      }
    } catch (error) {
      toast.error("Network error");
    } finally {
      setRequesting(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-[0_32px_128px_rgba(0,0,0,0.1)] overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-300">
        <div className="bg-amber-500 p-6 flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/5 rounded-full -ml-12 -mb-12"></div>
          
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-amber-600/20 ring-4 ring-white/10">
            <Zap className="w-8 h-8 text-amber-500 fill-current" />
          </div>
          
          <h2 className="text-2xl font-black text-white tracking-tighter uppercase mb-1">Out of <span className="opacity-60">Tokens</span></h2>
          <p className="text-amber-50 text-[9px] font-black uppercase tracking-[0.3em]">Enforcement Active</p>
        </div>
        
        <div className="p-6">
          <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] text-center mb-6 leading-relaxed">
            Choose a token pack or enter a custom amount <br /> to resume laboratory bookings.
          </p>
          
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {[100, 500, 1000].map(amt => (
              <button
                key={amt}
                onClick={() => setRequestedAmount(amt)}
                className={`py-3 rounded-xl font-black text-sm transition-all border-2 ${
                  requestedAmount === amt 
                  ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-500/20' 
                  : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'
                }`}
              >
                {amt}
              </button>
            ))}
          </div>

          <div className="relative group mb-8">
            <label className="absolute -top-3 left-6 px-2 bg-white text-[9px] font-black text-amber-600 uppercase tracking-widest z-10">Custom Quantity</label>
            <input 
              type="number"
              value={requestedAmount}
              onChange={(e) => setRequestedAmount(e.target.value)}
              className="w-full bg-slate-50/50 border-2 border-slate-100 rounded-xl p-3.5 text-lg font-black text-brand-dark outline-none focus:border-amber-500 focus:bg-white transition-all text-center placeholder:text-slate-200"
              placeholder="Qty"
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button 
              onClick={handleRequestTokens}
              disabled={requesting || !requestedAmount || requestedAmount <= 0}
              className="px-6 py-4 bg-brand-dark text-white rounded-[1.2rem] text-[9px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-brand-dark/20 flex items-center justify-center gap-2.5 disabled:opacity-50 group"
            >
              {requesting ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-amber-500 fill-current" />}
              Send Request
            </button>
            <button 
              onClick={onClose}
              className="px-6 py-4 bg-slate-50 text-slate-400 rounded-[1.2rem] text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all border border-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OutOfTokensModal;
