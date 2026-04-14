import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Loader, AlertCircle } from 'lucide-react';
import ReportPreview from '../components/ReportPreview';

const PublicReportView = () => {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [publicData, setPublicData] = useState(null);
    const [error, setError] = useState(null);

    const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

    useEffect(() => {
        if (token) {
            fetchPublicReport();
        }
    }, [token]);

    const fetchPublicReport = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${BACKEND_URL}/api/public/report/${token}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to fetch report');
            }

            setPublicData(data);
        } catch (err) {
            console.error("Public fetch error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin mb-6"></div>
                <h2 className="text-xl font-black text-brand-dark uppercase tracking-widest">Verifying Security Token</h2>
                <p className="text-slate-500 font-medium mt-2">Retrieving your diagnostic results securely...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white p-10 rounded-[40px] shadow-2xl border border-slate-100 max-w-md w-full">
                    <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                        <AlertCircle className="w-10 h-10 text-rose-500" />
                    </div>
                    <h2 className="text-2xl font-black text-brand-dark uppercase tracking-tight mb-4">Access Denied</h2>
                    <p className="text-slate-600 font-medium leading-relaxed mb-8">
                        {error === 'Report not found or link expired' 
                            ? "This report link is invalid or has expired. Please contact your laboratory for a fresh QR code."
                            : error}
                    </p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="w-full bg-brand-dark text-white font-black py-4 rounded-2xl hover:scale-105 transition-all shadow-xl"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    // Render the exact same professional ReportPreview directly
    return (
        <div className="min-h-screen bg-gray-900/95 app-public-view">
            <ReportPreview 
                report={{ id: publicData.reportData.id }} 
                isPublicView={true} 
                publicData={publicData} 
            />
        </div>
    );
};

export default PublicReportView;
