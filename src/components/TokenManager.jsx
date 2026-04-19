import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Zap } from 'lucide-react';

const TokenManager = () => {
  const { subscription } = useAuth();

  // Only show for token-based plans
  if (subscription?.plan !== 'pay_as_you_go') return null;

  const balance = subscription?.tokenBalance || 0;

  return (
    <div className="mx-4 my-2 flex items-center gap-2 py-1.5 px-3 bg-amber-500/5 border border-amber-500/10 rounded-full">
      <Zap className={`w-3 h-3 ${balance < 50 ? 'text-rose-500 animate-pulse' : 'text-amber-500'}`} />
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">
        Tokens: <span className={balance < 50 ? 'text-rose-600' : 'text-amber-600'}>{balance}</span>
      </span>
    </div>
  );
};

export default TokenManager;
