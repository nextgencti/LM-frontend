import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, Loader, UserPlus, Stethoscope, Phone, Mail, Trash2, X, Printer, Edit2, Users, IndianRupee, CreditCard, Activity } from 'lucide-react';
import { toast } from 'react-toastify';

const Doctors = () => {
  const { userData, activeLabId, currentUser, subscription, checkFeature } = useAuth();
  const isSuperAdmin = userData?.role === 'SuperAdmin';
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDoctor, setNewDoctor] = useState({
    name: '', phone: '', email: '', clinic: '', specialization: '', commissionType: 'Percentage', commissionValue: '0', status: 'Active'
  });
  const [editingDoc, setEditingDoc] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // --- LEDGER STATES ---
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [ledgerData, setLedgerData] = useState({ referrals: [], payments: [] });
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);
  const [isEmailing, setIsEmailing] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [newPayment, setNewPayment] = useState({ amount: '', method: 'Cash', notes: '' });

  const [ledgerDateRange, setLedgerDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchDoctors();
  }, [userData, activeLabId]);

  const fetchDoctors = async () => {
    if (!activeLabId && userData?.role !== 'SuperAdmin') return;
    setLoading(true);
    try {
      let q;
      if (activeLabId) {
        q = query(collection(db, 'doctors'), where('labId', '==', activeLabId));
      } else {
        q = query(collection(db, 'doctors'));
      }
      const querySnapshot = await getDocs(q);
      const docs = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      setDoctors(docs);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDoctor = async (e) => {
    e.preventDefault();
    if (!activeLabId) {
      toast.error("Please select a laboratory first.");
      return;
    }

    try {
      if (editingDoc) {
        // Update logic
        await updateDoc(doc(db, 'doctors', editingDoc.id), {
          ...newDoctor,
          updatedAt: serverTimestamp()
        });
        toast.success('Doctor details updated');
      } else {
        // Add logic
        await addDoc(collection(db, 'doctors'), {
          ...newDoctor,
          doctorId: `DOC-${Date.now()}`,
          labId: activeLabId,
          createdAt: serverTimestamp()
        });
        toast.success('Doctor added successfully');
      }
      
      setShowAddModal(false);
      setEditingDoc(null);
      setNewDoctor({ name: '', phone: '', email: '', clinic: '', specialization: '', commissionType: 'Percentage', commissionValue: '0', status: 'Active' });
      fetchDoctors();
    } catch (error) {
      console.error("Error saving doctor:", error);
      toast.error("Failed to save doctor details");
    }
  };

  const handleEditClick = (doc) => {
    setEditingDoc(doc);
    setNewDoctor({
      name: doc.name || '',
      phone: doc.phone || '',
      email: doc.email || '',
      clinic: doc.clinic || '',
      specialization: doc.specialization || '',
      commissionType: doc.commissionType || 'Percentage',
      commissionValue: doc.commissionValue || '0',
      status: doc.status || 'Active'
    });
    setShowAddModal(true);
  };

  const handleDeleteDoctor = async (id) => {
    try {
      await deleteDoc(doc(db, 'doctors', id));
      setDoctors(prev => prev.filter(d => d.id !== id));
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting doctor:", error);
      alert('Failed to delete doctor: ' + error.message);
      setDeleteConfirm(null);
    }
  };

  const fetchLedgerData = async (doctor) => {
    if (!checkFeature('Doctor Ledger Management')) {
      toast.info('🚀 Doctor Ledger is a premium feature. Please upgrade your plan to enable this.', { position: "top-center" });
      return;
    }
    setSelectedDoc(doctor);
    setIsLedgerOpen(true);
    setIsLedgerLoading(true);
    setLedgerData({ referrals: [], payments: [] });

    try {
      // 1. Fetch Referrals (Bookings where status is Final/Completed)
      const bRef = collection(db, 'bookings');
      const qB = query(
        bRef, 
        where('labId', '==', activeLabId), 
        where('doctorId', '==', doctor.id)
      );
      const snapB = await getDocs(qB);
      const allBookings = snapB.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Filter for Final/Completed only (logic: commission triggers on final)
      const finalBookings = allBookings.filter(b => 
        ['Final', 'Completed', 'Delivered'].includes(b.status)
      );

      // 2. Fetch Payments
      const pRef = collection(db, 'doctorPayments');
      const qP = query(pRef, where('labId', '==', activeLabId), where('doctorId', '==', doctor.id));
      const snapP = await getDocs(qP);
      const payments = snapP.docs.map(d => ({ id: d.id, ...d.data() }));

      setLedgerData({
        referrals: finalBookings,
        payments: payments.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
      });
    } catch (error) {
      console.error("Error fetching ledger:", error);
    } finally {
      setIsLedgerLoading(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedDoc || !newPayment.amount) return;

    try {
      await addDoc(collection(db, 'doctorPayments'), {
        labId: activeLabId,
        doctorId: selectedDoc.id,
        amount: parseFloat(newPayment.amount),
        method: newPayment.method,
        notes: newPayment.notes,
        date: serverTimestamp(),
        createdAt: serverTimestamp()
      });
      
      setNewPayment({ amount: '', method: 'Cash', notes: '' });
      setShowPaymentForm(false);
      // Refresh ledger
      fetchLedgerData(selectedDoc);
    } catch (error) {
      console.error("Error recording payment:", error);
      alert("Failed to record payment");
    }
  };

  const formatDate = (date) => {
     if (!date) return 'N/A';
     const d = date.toDate ? date.toDate() : new Date(date);
     return d.toLocaleDateString('en-GB').replace(/\//g, '-'); // en-GB gives DD/MM/YYYY
  };

  const handlePrintLedger = () => {
    if (!selectedDoc) return;
    
    const filteredReferrals = ledgerData.referrals.filter(b => {
      if (!b.createdAt) return true;
      const d = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      const dateStr = d.toISOString().split('T')[0];
      return dateStr >= ledgerDateRange.start && dateStr <= ledgerDateRange.end;
    });

    const earned = filteredReferrals.reduce((s, b) => s + calculateCommission(b, selectedDoc), 0);
    const paid = ledgerData.payments.reduce((s, p) => s + p.amount, 0);
    const balance = earned - paid;

    const printWindow = window.open('', '_blank');
    const html = `
      <html>
        <head>
          <title>Doctor Ledger - ${selectedDoc.name}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; }
            .header { border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
            .lab-info h1 { margin: 0; font-size: 24px; font-weight: 900; color: #020617; text-transform: uppercase; }
            .lab-info p { margin: 5px 0 0; font-size: 12px; color: #64748b; font-weight: 600; }
            .doc-info h2 { margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; }
            .doc-info p { margin: 5px 0 0; font-size: 11px; font-weight: 700; color: #10b981; text-transform: uppercase; }
            
            .summary-grid { display: flex; gap: 15px; margin-bottom: 40px; width: 100%; }
            .stat-card { flex: 1; padding: 15px; border: 1px solid #e2e8f0; border-radius: 10px; background: #ffffff; text-align: center; }
            .stat-label { font-size: 8px; font-weight: 800; text-transform: uppercase; color: #94a3b8; margin-bottom: 8px; letter-spacing: 0.1em; }
            .stat-value { font-size: 16px; font-weight: 900; color: #0f172a; }
            .stat-value.urgent { color: #ef4444; }

            h3 { font-size: 13px; font-weight: 900; text-transform: uppercase; border-left: 4px solid #10b981; padding-left: 10px; margin: 35px 0 15px; color: #1e293b; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { text-align: left; padding: 12px; font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; background: #f1f5f9; }
            td { padding: 12px; font-size: 11px; border-bottom: 1px solid #f1f5f9; font-weight: 500; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .footer { margin-top: 50px; font-size: 10px; text-align: center; color: #94a3b8; font-weight: 600; border-top: 1px solid #f1f5f9; padding-top: 20px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="lab-info">
              <h1>${subscription?.labFullName || subscription?.labName || 'Pathology Laboratory'}</h1>
              <p>Performance & Commission Ledger Report</p>
            </div>
            <div style="text-align: right">
              <p style="font-size: 10px; font-weight: 800; color: #94a3b8; margin: 0">REPORT PERIOD</p>
              <p style="font-size: 12px; font-weight: 700; margin: 5px 0 0">${formatDate(ledgerDateRange.start)} - ${formatDate(ledgerDateRange.end)}</p>
            </div>
          </div>

          <div class="doc-info" style="margin-bottom: 30px">
            <h2>Dr. ${selectedDoc.name}</h2>
            <p>${selectedDoc.clinic || 'Independent Practice'} • ID: ${selectedDoc.doctorId}</p>
          </div>

          <div class="summary-grid">
            <div class="stat-card">
              <div class="stat-label">Total Referrals</div>
              <div class="stat-value">${filteredReferrals.length}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Commission</div>
              <div class="stat-value">₹${earned.toFixed(0)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Paid</div>
              <div class="stat-value">₹${paid.toFixed(0)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Balance Due</div>
              <div class="stat-value urgent">₹${balance.toFixed(0)}</div>
            </div>
          </div>

          <h3>Referral Detailed Record</h3>
          <table>
            <thead>
              <tr>
                <th>Patient Name</th>
                <th>Date</th>
                <th>Tests</th>
                <th class="text-right">Paid Amount</th>
                <th class="text-right">Commission</th>
              </tr>
            </thead>
            <tbody>
              ${filteredReferrals.map(b => `
                <tr>
                  <td class="font-bold">${b.patientName}</td>
                  <td>${formatDate(b.createdAt)}</td>
                  <td>${b.testNames}</td>
                  <td class="text-right tabular-nums">₹${b.paidAmount}</td>
                  <td class="text-right tabular-nums font-bold">₹${calculateCommission(b, selectedDoc).toFixed(1)}</td>
                </tr>
              `).join('')}
              ${filteredReferrals.length === 0 ? '<tr><td colspan="5" style="text-align:center; padding: 40px; color: #94a3b8">No referrals found for this period.</td></tr>' : ''}
            </tbody>
          </table>

          <h3>Payment & Payout History</h3>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Method</th>
                <th>Notes / Remarks</th>
                <th class="text-right">Amount Paid</th>
              </tr>
            </thead>
            <tbody>
              ${ledgerData.payments.map(p => `
                <tr>
                  <td class="font-bold">${formatDate(p.date)}</td>
                  <td style="text-transform: uppercase; font-weight: 700; color: #0ea5e9">${p.method}</td>
                  <td>${p.notes || '—'}</td>
                  <td class="text-right tabular-nums font-bold">₹${p.amount.toFixed(0)}</td>
                </tr>
              `).join('')}
              ${ledgerData.payments.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding: 40px; color: #94a3b8">No payout records found.</td></tr>' : ''}
            </tbody>
          </table>

          <div class="footer">
            Generated on ${new Date().toLocaleString()} • This is a computer generated report.
          </div>
          
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleEmailLedger = async () => {
    if (!checkFeature('Email Support')) {
      toast.info('🚀 Email Ledger is a premium feature. Please upgrade your plan to enable this.', { position: "top-center" });
      return;
    }
    let targetEmail = selectedDoc?.email;
    
    if (!targetEmail) {
      toast.error("Doctor's email is missing. Please update the profile to send reports.");
      handleEditClick(selectedDoc);
      return;
    }

    setIsEmailing(true);
    const toastId = toast.loading(`Preparing to send report to ${targetEmail}...`);
    try {
      const filteredReferrals = ledgerData.referrals.filter(b => {
        if (!b.createdAt) return true;
        const d = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        const dateStr = d.toISOString().split('T')[0];
        return dateStr >= ledgerDateRange.start && dateStr <= ledgerDateRange.end;
      });

      const earned = filteredReferrals.reduce((s, b) => s + calculateCommission(b, selectedDoc), 0);
      const paid = ledgerData.payments.reduce((s, p) => s + p.amount, 0);
      const balance = earned - paid;

      const reportHtml = `
        <div style="font-family: Arial, sans-serif; padding: 30px; color: #1e293b; background: #f8fafc;">
          <div style="background: white; border-radius: 20px; padding: 40px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
            <div style="border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between;">
              <div>
                <h1 style="margin: 0; font-size: 24px; color: #020617; text-transform: uppercase;">${subscription?.labFullName || subscription?.labName || 'Pathology Laboratory'}</h1>
                <p style="margin: 5px 0 0; font-size: 12px; color: #64748b;">Financial Performance Report</p>
              </div>
            </div>

            <div style="margin-bottom: 30px;">
              <h2 style="margin: 0; font-size: 20px; color: #0f172a;">Dr. ${selectedDoc.name}</h2>
              <p style="margin: 5px 0 0; font-size: 11px; color: #10b981; font-weight: bold;">${selectedDoc.clinic || 'Practice'} • PERIOD: ${formatDate(ledgerDateRange.start)} - ${formatDate(ledgerDateRange.end)}</p>
            </div>

            <div style="display: flex; gap: 15px; margin-bottom: 40px;">
              <div style="flex: 1; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">
                <div style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Referrals</div>
                <div style="font-size: 18px; font-weight: 900; color: #0f172a;">${filteredReferrals.length}</div>
              </div>
              <div style="flex: 1; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">
                <div style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Commission</div>
                <div style="font-size: 18px; font-weight: 900; color: #059669;">₹${earned.toFixed(0)}</div>
              </div>
              <div style="flex: 1; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">
                <div style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Paid</div>
                <div style="font-size: 18px; font-weight: 900; color: #0284c7;">₹${paid.toFixed(0)}</div>
              </div>
              <div style="flex: 1; padding: 15px; border: 1px solid #ef4444; border-radius: 12px; text-align: center; background: #fef2f2;">
                <div style="font-size: 8px; font-weight: 800; color: #b91c1c; text-transform: uppercase;">Balance</div>
                <div style="font-size: 18px; font-weight: 900; color: #b91c1c;">₹${balance.toFixed(0)}</div>
              </div>
            </div>

            <h3 style="font-size: 12px; text-transform: uppercase; border-left: 4px solid #10b981; padding-left: 10px; margin-bottom: 15px;">Detailed Transaction Record</h3>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th style="padding: 10px; text-align: left; font-size: 10px; color: #64748b;">Patient Name</th>
                  <th style="padding: 10px; text-align: left; font-size: 10px; color: #64748b;">Date</th>
                  <th style="padding: 10px; text-align: right; font-size: 10px; color: #64748b;">Commission</th>
                </tr>
              </thead>
              <tbody>
                ${filteredReferrals.map(b => `
                  <tr>
                    <td style="padding: 10px; font-size: 11px; border-bottom: 1px solid #f1f5f9;"><b>${b.patientName}</b></td>
                    <td style="padding: 10px; font-size: 11px; border-bottom: 1px solid #f1f5f9;">${formatDate(b.createdAt)}</td>
                    <td style="padding: 10px; font-size: 11px; border-bottom: 1px solid #f1f5f9; text-align: right;"><b>₹${calculateCommission(b, selectedDoc).toFixed(1)}</b></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <p style="font-size: 10px; color: #94a3b8; text-align: center;">Generated via Lab Mitra Pathology System</p>
          </div>
        </div>
      `;

      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const token = await currentUser.getIdToken();

      const response = await fetch(`${BACKEND_URL}/api/send-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          to: targetEmail,
          subject: `Monthly Commission Ledger - Dr. ${selectedDoc.name} (${formatDate(ledgerDateRange.start)} to ${formatDate(ledgerDateRange.end)})`,
          patientName: selectedDoc.name,
          labName: subscription?.labName,
          reportHtml: reportHtml
        })
      });

      const data = await response.json();
      if (data.success) {
        toast.update(toastId, { render: `Ledger emailed successfully to ${targetEmail}`, type: "success", isLoading: false, autoClose: 3000 });
      } else {
        throw new Error(data.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Email Error:', error);
      toast.update(toastId, { render: error.message, type: "error", isLoading: false, autoClose: 4000 });
    } finally {
      setIsEmailing(false);
    }
  };

  const calculateCommission = (booking, doctor) => {
    const paid = parseFloat(booking.paidAmount) || 0;
    const value = parseFloat(doctor.commissionValue) || 0;
    
    if (doctor.commissionType === 'Percentage') {
        return (paid * (value / 100));
    } else {
        // Fixed is usually per referral/booking
        return value;
    }
  };

  const filteredDoctors = doctors.filter(d => 
    d.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone?.includes(searchTerm)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-brand-dark tracking-tighter flex items-center">
            <div className="p-2 bg-brand-light rounded-xl mr-4 shadow-sm border border-brand-primary/10">
              <Stethoscope className="w-8 h-8 text-brand-primary" />
            </div>
            Doctors
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Manage your referring doctors here.</p>
        </div>
        
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-6 py-3 bg-brand-dark text-white rounded-2xl font-black hover:shadow-2xl hover:shadow-brand-dark/20 hover:-translate-y-1 transition-all duration-300 group active:scale-95 shadow-lg tracking-widest text-[11px] uppercase"
        >
          <Plus className="w-5 h-5 mr-2 group-hover:rotate-90 transition-transform duration-300 text-brand-primary" />
          Add Doctor
        </button>
      </div>

      {/* Search & Statistics */}
      <div className="flex flex-col md:flex-row gap-4 mb-8">
        <div className="relative flex-grow group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-[22px] focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 transition-all text-sm font-bold placeholder:text-slate-400 placeholder:font-medium shadow-sm hover:border-slate-300"
            placeholder="Search by doctor name or clinic..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center px-6 bg-white rounded-[22px] border border-slate-100 shadow-sm whitespace-nowrap">
          <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest mr-3">Total Doctors:</span>
          <span className="text-lg font-black text-brand-dark tabular-nums">{doctors.length}</span>
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-[0_20px_50px_rgb(0,0,0,0.02)] border border-slate-100 overflow-hidden relative">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-brand-light/30">
              <tr>
                <th scope="col" className="px-8 py-5 text-left text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Doctor Name</th>
                <th scope="col" className="px-8 py-5 text-left text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Clinic / Hospital</th>
                <th scope="col" className="px-8 py-5 text-left text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Commission</th>
                <th scope="col" className="px-8 py-5 text-left text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Status</th>
                <th scope="col" className="px-8 py-5 text-right text-[12px] font-black text-brand-dark uppercase tracking-[0.2em]">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center">
                    <Loader className="h-10 w-10 animate-spin text-brand-primary mx-auto mb-4" />
                    <p className="text-slate-400 font-black uppercase text-[12px] tracking-widest">Loading...</p>
                  </td>
                </tr>
              ) : filteredDoctors.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-8 py-20 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-300">
                      <Stethoscope className="w-8 h-8" />
                    </div>
                    <p className="text-slate-500 font-bold">No doctors found.</p>
                  </td>
                </tr>
              ) : (
                filteredDoctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-brand-light/10 transition-colors group">
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 bg-brand-light rounded-xl flex items-center justify-center text-brand-dark font-black shadow-sm border border-brand-primary/10 group-hover:scale-110 transition-transform">
                          {doc.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-black text-brand-dark tracking-tight">{doc.name}</div>
                          <div className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">ID: {doc.doctorId || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-700 tracking-tight">{doc.clinic || 'Independent Practice'}</span>
                        {doc.phone && (
                          <div className="flex items-center mt-1 text-slate-400">
                             <Phone className="w-3 h-3 mr-1.5" />
                             <span className="text-sm font-medium">{doc.phone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="inline-flex items-center px-3 py-1 bg-brand-light rounded-lg text-[12px] font-black text-brand-dark uppercase tracking-widest border border-brand-primary/10">
                        {doc.commissionValue}{doc.commissionType === 'Percentage' ? '%' : ' Fixed'}
                      </div>
                    </td>
                    <td className="px-8 py-6 whitespace-nowrap">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-[12px] font-black uppercase tracking-widest ${
                        doc.status === 'Active' ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20' : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full mr-2 ${doc.status === 'Active' ? 'bg-brand-primary animate-pulse' : 'bg-slate-300'}`}></div>
                        {doc.status}
                      </span>
                    </td>
                     <td className="px-8 py-6 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => fetchLedgerData(doc)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all shadow-sm active:scale-95 flex items-center gap-2 ${
                            checkFeature('Doctor Ledger Management') 
                            ? 'bg-brand-light text-brand-dark border-brand-primary/10 hover:bg-brand-primary hover:text-white' 
                            : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-70'
                          }`}
                        >
                          {!checkFeature('Doctor Ledger Management') && <Activity className="w-3 h-3 text-brand-primary animate-pulse" />}
                          View Ledger
                        </button>
                        {doc.phone && (
                          <a href={`tel:${doc.phone}`} className="p-2 text-brand-primary hover:bg-brand-primary/10 rounded-xl transition-all" title="Call Doctor">
                            <Phone className="w-5 h-5" />
                          </a>
                        )}
                        <button
                          onClick={() => handleEditClick(doc)}
                          className="p-2 text-sky-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition-all"
                          title="Edit Profile"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => setDeleteConfirm(doc.id)}
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                            title="Remove from Registry"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-3xl flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-[0_32px_128px_rgba(0,0,0,0.3)] max-w-2xl w-full border border-white/20 animate-in zoom-in-95 duration-500 overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="px-10 py-8 bg-brand-dark text-white flex justify-between items-center shrink-0 border-b border-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full blur-[80px] -mr-20 -mt-20"></div>
               <div className="relative z-10 flex items-center gap-5">
                  <div className="p-3 bg-brand-primary rounded-[18px] transition-transform rotate-3 hover:rotate-6">
                     <Stethoscope className="w-6 h-6 text-white" />
                  </div>
                   <div>
                      <h2 className="text-2xl font-black tracking-tighter uppercase leading-none">{editingDoc ? 'Edit Doctor' : 'Add Doctor'}</h2>
                      <p className="text-[9px] font-black text-brand-primary uppercase tracking-[0.4em] mt-1.5">{editingDoc ? 'Update Profile Details' : 'Doctor Registry Setup'}</p>
                   </div>
               </div>
               <button onClick={() => setShowAddModal(false)} className="relative z-10 w-12 h-12 flex justify-center items-center bg-white/5 hover:bg-white/10 rounded-2xl transition-all text-white/50 border border-white/5">
                  <span className="text-xl">&times;</span>
               </button>
            </div>
            
            <form onSubmit={handleSubmitDoctor} className="flex-grow flex flex-col overflow-hidden">
              <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Doctor Name *</label>
                  <input 
                    required 
                    type="text" 
                    placeholder="Enter doctor's name"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-slate-300 placeholder:font-medium" 
                    value={newDoctor.name} 
                    onChange={e => setNewDoctor({...newDoctor, name: e.target.value})} 
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Phone Number</label>
                    <input 
                      type="tel" 
                      placeholder="10-digit mobile number"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-slate-300 placeholder:font-medium" 
                      value={newDoctor.phone} 
                      onChange={e => setNewDoctor({...newDoctor, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email <span className="text-brand-primary lowercase tracking-normal font-bold opacity-80">(Needed for reports)</span></label>
                    <input 
                      type="email" 
                      placeholder="doctor@email.com"
                      className="w-full px-4 py-3 bg-amber-50/50 border border-amber-500/30 focus:border-amber-500 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-amber-500/50 placeholder:font-medium" 
                      value={newDoctor.email} 
                      onChange={e => setNewDoctor({...newDoctor, email: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Specialization</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Cardiologist"
                      list="specializationList"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-slate-300 placeholder:font-medium" 
                      value={newDoctor.specialization} 
                      onChange={e => setNewDoctor({...newDoctor, specialization: e.target.value})} 
                    />
                    <datalist id="specializationList">
                      <option value="General Physician" />
                      <option value="Cardiologist" />
                      <option value="Neurologist" />
                      <option value="Orthopedic" />
                      <option value="Pediatrician" />
                      <option value="Gynecologist" />
                      <option value="Dermatologist" />
                      <option value="Oncologist" />
                      <option value="Endocrinologist" />
                      <option value="Gastroenterologist" />
                      <option value="Psychiatrist" />
                      <option value="ENT Specialist" />
                      <option value="Dentist" />
                      <option value="Pulmonologist" />
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Clinic / Hospital</label>
                    <input 
                      type="text" 
                      placeholder="Enter base location"
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-slate-300 placeholder:font-medium" 
                      value={newDoctor.clinic} 
                      onChange={e => setNewDoctor({...newDoctor, clinic: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Commission Structure</label>
                    <div className="flex gap-2">
                      <select 
                        className="w-1/2 px-4 py-3 bg-slate-50 border border-slate-100 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none cursor-pointer text-sm"
                        value={newDoctor.commissionType} 
                        onChange={e => setNewDoctor({...newDoctor, commissionType: e.target.value})}
                      >
                        <option>Percentage</option>
                        <option>Fixed</option>
                      </select>
                      <input 
                        type="number" 
                        placeholder="0"
                        className="w-1/2 px-4 py-3 bg-slate-50 border-2 border-transparent focus:border-brand-primary/50 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none placeholder:text-slate-300"
                        value={newDoctor.commissionValue} 
                        onChange={e => setNewDoctor({...newDoctor, commissionValue: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Account Status</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 focus:bg-white rounded-xl transition-all font-bold text-brand-dark outline-none cursor-pointer text-sm"
                      value={newDoctor.status} 
                      onChange={e => setNewDoctor({...newDoctor, status: e.target.value})}
                    >
                      <option>Active</option>
                      <option>Inactive</option>
                    </select>
                  </div>
                </div>

              </div>

              <div className="px-8 py-5 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingDoc(null);
                    setNewDoctor({
                      name: '', phone: '', email: '', clinic: '', specialization: '', commissionType: 'Percentage', commissionValue: '0', status: 'Active'
                    });
                  }}
                  className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:text-brand-dark hover:border-slate-300 transition-all shadow-sm"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-3 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-brand-primary/20 hover:scale-[1.02] active:scale-[0.98]"
                >
                  {editingDoc ? 'Update Details' : 'Save Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Doctor Ledger Modal - PREMIUM OVERHAUL */}
      {isLedgerOpen && selectedDoc && (
        <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-xl flex items-center justify-center z-[60] animate-in fade-in duration-500 p-3 md:p-8">
          <div className="bg-white h-full w-full max-w-7xl shadow-[0_32px_128px_rgba(0,0,0,0.5)] rounded-[32px] md:rounded-[48px] flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20">
            
            {/* Modal Header - Refined Premium */}
            <div className="px-8 py-8 md:px-12 md:py-12 bg-brand-dark text-white relative overflow-hidden shrink-0">
               <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-primary/10 rounded-full blur-[120px] -mr-48 -mt-48"></div>
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-secondary/5 rounded-full blur-[100px] -ml-20 -mb-20"></div>
               
               <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                  <div className="flex items-center gap-6 md:gap-8">
                     <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-[24px] md:rounded-[32px] flex items-center justify-center rotate-3 shadow-2xl shadow-black/20 overflow-hidden p-3 border border-white/10 group hover:rotate-6 transition-transform">
                        <img src="/favicon.png" alt="Logo" className="w-full h-full object-contain" />
                     </div>
                     <div>
                        <h2 className="text-2xl md:text-4xl font-black tracking-tighter uppercase leading-none truncate max-w-[200px] sm:max-w-none">{selectedDoc.name}</h2>
                        <div className="flex flex-wrap items-center gap-3 mt-3">
                           <span className="text-[10px] md:text-[11px] font-black text-brand-primary uppercase tracking-[0.4em]">{selectedDoc.clinic || 'Medical Practice'}</span>
                           <span className="w-1.5 h-1.5 rounded-full bg-white/20"></span>
                           <span className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">ID: {selectedDoc.doctorId}</span>
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                     <button 
                       disabled={isEmailing}
                       onClick={handleEmailLedger}
                       className="flex-1 md:flex-none px-6 py-4 bg-brand-primary/10 hover:bg-brand-primary text-brand-primary hover:text-white rounded-[20px] transition-all border border-brand-primary/20 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest group disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-brand-primary/5 active:scale-95"
                     >
                        {isEmailing ? <Loader className="w-4 h-4 animate-spin text-white" /> : <Mail className="w-4 h-4 group-hover:scale-110 transition-transform" />}
                        <span>{isEmailing ? 'Dispatching...' : 'Email Report'}</span>
                     </button>
                     <button 
                       onClick={handlePrintLedger}
                       className="flex-1 md:flex-none px-6 py-4 bg-white/5 hover:bg-white text-white hover:text-brand-dark rounded-[20px] transition-all border border-white/5 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest group shadow-xl active:scale-95"
                     >
                        <Printer className="w-4 h-4 text-brand-primary group-hover:text-brand-dark group-hover:scale-110 transition-transform" />
                        <span>Print Ledger</span>
                     </button>
                     <button onClick={() => setIsLedgerOpen(false)} className="w-12 h-12 md:w-14 md:h-14 flex justify-center items-center bg-white/5 hover:bg-rose-500 rounded-[22px] transition-all border border-white/5 text-white/50 hover:text-white shadow-xl">
                        <X className="w-6 h-6 md:w-7 md:h-7" />
                     </button>
                  </div>
               </div>
            </div>

            {/* Modal Body - High Fidelity */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-6 sm:p-10 md:p-14 space-y-12 bg-[#FBFBFE]">
               
               {/* Controls & Statistics Grid */}
               <div className="space-y-10">
                  <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
                     {/* Refined Date Toolbar */}
                     <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-0 sm:gap-4 bg-white p-2 rounded-[24px] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full lg:w-auto overflow-hidden">
                        <div className="flex items-center gap-4 px-5 py-3 sm:py-0 border-b sm:border-b-0 sm:border-r border-slate-50 last:border-0 grow">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">From Date</span>
                           <input 
                              type="date" 
                              className="bg-transparent border-none p-2 text-[13px] font-black text-brand-dark outline-none grow focus:ring-0"
                              value={ledgerDateRange.start}
                              onChange={(e) => setLedgerDateRange(prev => ({ ...prev, start: e.target.value }))}
                           />
                        </div>
                        <div className="flex items-center gap-4 px-5 py-3 sm:py-0 grow">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">To Date</span>
                           <input 
                              type="date" 
                              className="bg-transparent border-none p-2 text-[13px] font-black text-brand-dark outline-none grow focus:ring-0"
                              value={ledgerDateRange.end}
                              onChange={(e) => setLedgerDateRange(prev => ({ ...prev, end: e.target.value }))}
                           />
                        </div>
                     </div>

                     {/* Action Button: Payout */}
                     <button 
                        onClick={() => setShowPaymentForm(!showPaymentForm)}
                        className={`flex items-center justify-center w-full lg:w-auto px-10 py-5 rounded-[24px] font-black text-[11px] uppercase tracking-[0.2em] transition-all shadow-2xl active:scale-95 ${
                        showPaymentForm ? 'bg-rose-50 text-rose-600 border border-rose-100 shadow-rose-500/10' : 'bg-brand-dark text-white border border-white/10 shadow-brand-dark/20 hover:bg-brand-secondary'
                        }`}
                     >
                        {showPaymentForm ? 'Cancel Payment' : 'Record New Payout'}
                     </button>
                  </div>

                  {/* High-Fidelity Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                     {(() => {
                        const filteredReferrals = ledgerData.referrals.filter(b => {
                           if (!b.createdAt) return true;
                           const d = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                           const dateStr = d.toISOString().split('T')[0];
                           return dateStr >= ledgerDateRange.start && dateStr <= ledgerDateRange.end;
                        });

                        const earned = filteredReferrals.reduce((s, b) => s + calculateCommission(b, selectedDoc), 0);
                        const paid = ledgerData.payments.reduce((s, p) => s + p.amount, 0);
                        const balance = earned - paid;

                        return [
                           { label: 'Total Referrals', val: filteredReferrals.length, unit: 'Patients', icon: <Users className="w-5 h-5"/>, color: 'brand' },
                           { label: 'Total Earnings', val: earned.toFixed(0), unit: 'INR', icon: <IndianRupee className="w-5 h-5"/>, color: 'emerald' },
                           { label: 'Total Paid', val: paid.toFixed(0), unit: 'INR', icon: <CreditCard className="w-5 h-5"/>, color: 'sky' },
                           { label: 'Balance Due', val: balance.toFixed(0), unit: 'INR', icon: <Activity className="w-5 h-5"/>, color: 'rose' }
                        ].map((stat, i) => (
                           <div key={i} className="bg-white p-7 md:p-9 rounded-[32px] border border-slate-100 shadow-[0_15px_60px_rgb(0,0,0,0.02)] transition-all hover:shadow-[0_20px_80px_rgb(0,0,0,0.05)] hover:-translate-y-1 group relative overflow-hidden">
                              <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl -mr-12 -mt-12 transition-opacity opacity-0 group-hover:opacity-40 ${
                                 stat.color === 'emerald' ? 'bg-emerald-500' : 
                                 stat.color === 'brand' ? 'bg-brand-primary' :
                                 stat.color === 'rose' ? 'bg-rose-500' : 'bg-sky-500'
                              }`}></div>
                              
                              <div className="flex justify-between items-start mb-6">
                                 <div className={`p-4 rounded-2xl ${
                                    stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-500' : 
                                    stat.color === 'brand' ? 'bg-brand-light text-brand-primary' :
                                    stat.color === 'rose' ? 'bg-rose-50 text-rose-500' : 'bg-sky-50 text-sky-500'
                                 }`}>
                                    {stat.icon}
                                 </div>
                                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{stat.unit}</p>
                              </div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{stat.label}</p>
                              <div className="flex items-baseline gap-2">
                                 <p className={`text-2xl md:text-3xl font-black tracking-tighter tabular-nums ${
                                    stat.color === 'rose' ? 'text-rose-500' : 
                                    stat.color === 'emerald' ? 'text-emerald-500' :
                                    stat.color === 'sky' ? 'text-sky-500' : 'text-brand-dark'
                                 }`}>
                                    {stat.val === 0 ? '00' : (stat.unit === 'INR' ? `₹${stat.val}` : stat.val)}
                                 </p>
                              </div>
                           </div>
                        ));
                     })()}
                  </div>
               </div>

               {/* New Payout Form - Refined Block */}
               {showPaymentForm && (
                  <div className="p-10 bg-white rounded-[40px] border border-slate-100 shadow-2xl animate-in slide-in-from-top-6 duration-500 relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
                     <div className="relative z-10 space-y-8">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                              <Plus className="w-6 h-6" />
                           </div>
                           <div>
                              <h4 className="text-sm font-black text-brand-dark uppercase tracking-widest">Record New Payout</h4>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Enter Payout Details</p>
                           </div>
                        </div>
                        <form onSubmit={handleRecordPayment} className="grid grid-cols-1 md:grid-cols-4 gap-8 items-end">
                           <div className="space-y-3">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Amount (₹)</label>
                              <input 
                                 required type="number" 
                                 className="w-full px-6 py-5 bg-slate-50 border border-transparent focus:bg-white focus:border-brand-primary placeholder:text-slate-200 rounded-2xl font-black outline-none transition-all shadow-inner text-lg" 
                                 placeholder="₹ 0.00"
                                 value={newPayment.amount}
                                 onChange={e => setNewPayment({...newPayment, amount: e.target.value})}
                              />
                           </div>
                           <div className="space-y-3">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Payment Method</label>
                              <select 
                                 className="w-full px-6 py-5 bg-slate-50 border border-transparent focus:bg-white focus:border-brand-primary rounded-2xl font-black outline-none appearance-none cursor-pointer shadow-inner"
                                 value={newPayment.method}
                                 onChange={e => setNewPayment({...newPayment, method: e.target.value})}
                              >
                                 {['Cash', 'UPI / PhonePe', 'Bank Transfer', 'Cheque'].map(m => <option key={m}>{m}</option>)}
                              </select>
                           </div>
                           <div className="md:col-span-2 space-y-3">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Payment Notes</label>
                              <div className="flex gap-4">
                                 <input 
                                    type="text" 
                                    className="flex-grow px-6 py-5 bg-slate-50 border border-transparent focus:bg-white focus:border-brand-primary rounded-2xl font-bold outline-none transition-all shadow-inner" 
                                    placeholder="Optional reference notes..."
                                    value={newPayment.notes}
                                    onChange={e => setNewPayment({...newPayment, notes: e.target.value})}
                                 />
                                 <button 
                                    type="submit"
                                    className="px-10 py-5 bg-brand-dark text-brand-primary rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl hover:bg-black transition-all active:scale-95 whitespace-nowrap"
                                 >
                                    Record Payout
                                 </button>
                              </div>
                           </div>
                        </form>
                     </div>
                  </div>
               )}

               {/* Data Grids: History & Records */}
               <div className="grid grid-cols-1 gap-14">
                  
                  {/* Referral Detailed Record */}
                  <div className="space-y-8">
                     <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-black text-brand-dark tracking-tighter uppercase flex items-center gap-4">
                           <div className="w-8 h-8 bg-brand-light rounded-lg flex items-center justify-center text-brand-primary">
                              <Activity className="w-4 h-4" />
                           </div>
                           Referral History
                        </h3>
                        <div className="text-[10px] px-4 py-2 bg-white border border-slate-100 rounded-full text-slate-400 font-black uppercase tracking-widest shadow-sm">
                           {ledgerData.referrals.length} Clinical Records
                        </div>
                     </div>
                     <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-[0_10px_40px_rgb(0,0,0,0.02)]">
                        <div className="overflow-x-auto">
                           <table className="min-w-full divide-y divide-slate-50">
                              <thead className="bg-slate-50/50">
                                 <tr>
                                    <th className="px-10 py-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Patient / Date</th>
                                    <th className="px-10 py-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Tests</th>
                                    <th className="px-10 py-6 text-right text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Paid Amount</th>
                                    <th className="px-10 py-6 text-right text-[11px] font-black text-brand-primary uppercase tracking-[0.2em]">Commission</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                 {ledgerData.referrals
                                 .filter(b => {
                                    if (!b.createdAt) return true;
                                    const d = b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
                                    const dateStr = d.toISOString().split('T')[0];
                                    return dateStr >= ledgerDateRange.start && dateStr <= ledgerDateRange.end;
                                 })
                                 .map((b, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                       <td className="px-10 py-8">
                                          <div className="text-sm font-black text-brand-dark uppercase tracking-tight group-hover:text-brand-primary transition-colors">{b.patientName}</div>
                                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{formatDate(b.createdAt)}</div>
                                       </td>
                                       <td className="px-10 py-8 min-w-[300px]">
                                          <div className="text-[11px] font-black text-slate-500 uppercase leading-relaxed tracking-tight break-words">{b.testNames}</div>
                                       </td>
                                       <td className="px-10 py-8 text-right tabular-nums text-sm font-black text-slate-400">₹{b.paidAmount}</td>
                                       <td className="px-10 py-8 text-right tabular-nums text-base font-black text-brand-dark">₹{calculateCommission(b, selectedDoc).toFixed(1)}</td>
                                    </tr>
                                 ))}
                                 {ledgerData.referrals.length === 0 && (
                                    <tr><td colSpan="4" className="px-10 py-24 text-center">
                                       <div className="flex flex-col items-center opacity-20">
                                          <Activity className="w-12 h-12 mb-4" />
                                          <p className="text-[11px] font-black uppercase tracking-[0.4em]">No Activity Records Found</p>
                                       </div>
                                    </td></tr>
                                 )}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  </div>

                  {/* Payouts Detailed History */}
                  <div className="space-y-8 pb-10">
                     <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-black text-brand-dark tracking-tighter uppercase flex items-center gap-4">
                           <div className="w-8 h-8 bg-sky-50 rounded-lg flex items-center justify-center text-sky-500">
                              <IndianRupee className="w-4 h-4" />
                           </div>
                           Payout History
                        </h3>
                        <div className="text-[10px] px-4 py-2 bg-white border border-slate-100 rounded-full text-slate-400 font-black uppercase tracking-widest shadow-sm">
                           {ledgerData.payments.length} Records
                        </div>
                     </div>
                     <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-[0_10px_40px_rgb(0,0,0,0.02)]">
                        <div className="overflow-x-auto">
                           <table className="min-w-full divide-y divide-slate-50">
                              <thead className="bg-slate-50/50">
                                 <tr>
                                    <th className="px-10 py-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Date</th>
                                    <th className="px-10 py-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Method / Notes</th>
                                    <th className="px-10 py-6 text-right text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Amount Paid</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-50">
                                 {ledgerData.payments.map((p, i) => (
                                 <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-10 py-8 tabular-nums text-sm font-black text-brand-dark uppercase">
                                       {formatDate(p.date)}
                                    </td>
                                    <td className="px-10 py-8">
                                       <div className="text-sm font-black text-sky-500 uppercase tracking-tight group-hover:translate-x-1 transition-transform inline-block">{p.method}</div>
                                       <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1.5">{p.notes || 'No Reference Provided'}</div>
                                    </td>
                                    <td className="px-10 py-8 text-right tabular-nums text-base font-black text-slate-900 border-l border-slate-50">₹{p.amount.toFixed(0)}</td>
                                 </tr>
                                 ))}
                                 {ledgerData.payments.length === 0 && (
                                    <tr><td colSpan="3" className="px-10 py-24 text-center">
                                       <div className="flex flex-col items-center opacity-20">
                                          <IndianRupee className="w-12 h-12 mb-4" />
                                          <p className="text-[11px] font-black uppercase tracking-[0.4em]">No Payout Records Available</p>
                                       </div>
                                    </td></tr>
                                 )}
                              </tbody>
                           </table>
                        </div>
                     </div>
                  </div>

               </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Doctors;
