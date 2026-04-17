import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { Search, Plus, Loader, UserPlus, Stethoscope, Phone, Mail, Trash2, X, Printer, Edit2, Users, IndianRupee, CreditCard, Activity, CheckSquare, Square, Info } from 'lucide-react';
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
  const [selectedBillIds, setSelectedBillIds] = useState(new Set());
  const [referralStatusFilter, setReferralStatusFilter] = useState('ALL');
  const payoutFormRef = useRef(null);
  const ledgerTopRef = useRef(null);

  // Auto-scroll logic
  useEffect(() => {
    if (showPaymentForm && payoutFormRef.current) {
      setTimeout(() => {
        payoutFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } else if (!showPaymentForm && ledgerTopRef.current && isLedgerOpen) {
      ledgerTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showPaymentForm]);

  // Helper: get YYYY-MM-DD in LOCAL timezone (not UTC)
  const toLocalDateStr = (date) => {
    const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [ledgerDateRange, setLedgerDateRange] = useState({
    start: toLocalDateStr(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)),
    end: toLocalDateStr(new Date())
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

      const data = {
        referrals: finalBookings,
        payments: payments.sort((a, b) => (b.date?.seconds || 0) - (a.date?.seconds || 0))
      };
      setLedgerData(data);
      return data;
    } catch (error) {
      console.error("Error fetching ledger:", error);
      return null;
    } finally {
      setIsLedgerLoading(false);
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!selectedDoc || !newPayment.amount) return;
    if (selectedBillIds.size === 0) {
      toast.warn("Please select at least one bill to clear.");
      return;
    }

    try {
      const clearedIds = Array.from(selectedBillIds);
      const payAmount = parseFloat(newPayment.amount);

      // 1. Save payout record with audit trail
      await addDoc(collection(db, 'doctorPayments'), {
        labId: activeLabId,
        doctorId: selectedDoc.id,
        amount: payAmount,
        method: newPayment.method,
        notes: newPayment.notes,
        clearedBookingIds: clearedIds,
        date: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // 2. Batch update each selected booking: commissionCleared = true
      const batch = writeBatch(db);
      clearedIds.forEach(bookingId => {
        const bookingRef = doc(db, 'bookings', bookingId);
        batch.update(bookingRef, { commissionCleared: true });
      });
      await batch.commit();

      toast.success(`Payout of ₹${payAmount} recorded! ${clearedIds.length} bills cleared.`);
      
      // Reset form and selection
      setNewPayment({ amount: '', method: 'Cash', notes: '' });
      setSelectedBillIds(new Set());
      setShowPaymentForm(false);
      
      // 3. Refresh and prompt for email dispatch
      const freshData = await fetchLedgerData(selectedDoc);
      
      if (freshData) {
        const sendEmail = window.confirm(`Payout of ₹${payAmount} recorded successfully! Would you like to send the updated ledger report to Dr. ${selectedDoc.name} via email?`);
        if (sendEmail) {
           handleEmailLedger(freshData);
        }
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error("Failed to record payout. Please try again.");
    }
  };

  const handleResetPayoutHistory = async () => {
    if (!selectedDoc) return;
    const confirmDelete = window.confirm("Are you sure you want to delete ALL payout history for this doctor? This action cannot be undone and will reset the payout records list.");
    if (!confirmDelete) return;

    try {
      setIsLedgerLoading(true);
      const batch = writeBatch(db);
      
      // 1. Get all payment records for this doctor
      const pRef = collection(db, 'doctorPayments');
      const q = query(pRef, where('labId', '==', activeLabId), where('doctorId', '==', selectedDoc.id));
      const snap = await getDocs(q);
      
      snap.forEach(d => {
        batch.delete(doc(db, 'doctorPayments', d.id));
      });

      // 2. Also reset commissionCleared on ALL bookings for this doctor to start fully fresh
      const bRef = collection(db, 'bookings');
      const qB = query(bRef, where('labId', '==', activeLabId), where('doctorId', '==', selectedDoc.id));
      const snapB = await getDocs(qB);
      
      snapB.forEach(d => {
        if (d.data().commissionCleared) {
          batch.update(doc(db, 'bookings', d.id), { commissionCleared: false });
        }
      });

      await batch.commit();
      toast.success("Payout history and clearance status has been reset successfully.");
      
      // Clear local states
      setSelectedBillIds(new Set());
      setNewPayment(p => ({ ...p, amount: '' }));
      
      // Refresh
      fetchLedgerData(selectedDoc);
    } catch (error) {
      console.error("Error resetting history:", error);
      toast.error("Failed to reset payout history");
    } finally {
      setIsLedgerLoading(false);
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
      const dateStr = toLocalDateStr(b.createdAt);
      return dateStr >= ledgerDateRange.start && dateStr <= ledgerDateRange.end;
    });

    const filteredPayments = ledgerData.payments.filter(p => {
       const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date || Date.now());
       const dateStr = toLocalDateStr(pDate);
       return dateStr >= ledgerDateRange.start && dateStr <= ledgerDateRange.end;
    });

    let openingEarned = 0;
    let openingPaid = 0;
    let periodEarned = 0;
    let periodPaid = 0;

    ledgerData.referrals.forEach(b => {
       const comm = calculateCommission(b, selectedDoc);
       const dStr = b.createdAt ? toLocalDateStr(b.createdAt) : null;
       if (dStr && dStr < ledgerDateRange.start) {
          openingEarned += comm;
       } else if (dStr && dStr <= ledgerDateRange.end) {
          periodEarned += comm;
       }
    });

    ledgerData.payments.forEach(p => {
       const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date || Date.now());
       const dStr = toLocalDateStr(pDate);
       if (dStr < ledgerDateRange.start) {
          openingPaid += p.amount;
       } else if (dStr <= ledgerDateRange.end) {
          periodPaid += p.amount;
       }
    });

    const arrears = openingEarned - openingPaid;
    const totalDue = (openingEarned + periodEarned) - (openingPaid + periodPaid);

    const printWindow = window.open('', '_blank', 'width=900,height=900');
    if (!printWindow) {
      alert('Mobile browser ne popup block kar diya hai. Please settings me "Allow Popups" karein ya fir desktop par try karein.');
      return;
    }

    const html = `
      <html>
        <head>
          <title>Doctor Ledger - ${selectedDoc.name}</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; color: #1e293b; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
              body { padding: 0; margin: 0; }
              .no-print { display: none; }
              @page { size: A4; margin: 10mm; }
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
              <div class="stat-label">Opening Balance</div>
              <div class="stat-value">₹${arrears.toFixed(0)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Period Commission</div>
              <div class="stat-value">₹${periodEarned.toFixed(0)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Period Paid</div>
              <div class="stat-value">₹${periodPaid.toFixed(0)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label" style="color: #ef4444">Net Outstanding</div>
              <div class="stat-value" style="color: #ef4444">₹${totalDue.toFixed(0)}</div>
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
            </tbody>
            <tfoot style="background: #f8fafc; font-weight: 800; border-top: 2px solid #e2e8f0; color: #0f172a;">
              <tr>
                <td colspan="3" style="padding: 12px; text-align: right; text-transform: uppercase; font-size: 10px; color: #64748b;">Total for Period</td>
                <td style="padding: 12px; text-align: right;">₹${filteredReferrals.reduce((s, b) => s + (parseFloat(b.paidAmount) || 0), 0).toFixed(0)}</td>
                <td style="padding: 12px; text-align: right; color: #059669;">₹${periodEarned.toFixed(0)}</td>
              </tr>
            </tfoot>
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
              ${filteredPayments.map(p => `
                <tr>
                  <td class="font-bold">${formatDate(p.date)}</td>
                  <td style="text-transform: uppercase; font-weight: 700; color: #0ea5e9">${p.method}</td>
                  <td>${p.notes || '—'}</td>
                  <td class="text-right tabular-nums font-bold">₹${p.amount.toFixed(0)}</td>
                </tr>
              `).join('')}
              ${filteredPayments.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding: 40px; color: #94a3b8">No payout records found for this period.</td></tr>' : ''}
            </tbody>
          </table>

          <div style="margin-top: 40px; padding: 20px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
            <h4 style="margin: 0 0 15px 0; font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">Ledger Terms Glossary / शब्दावली</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div style="font-size: 10px; line-height: 1.5;">
                <p style="margin: 0; font-weight: 700; color: #1e293b;">Opening Balance (Arrears):</p>
                <p style="margin: 2px 0 0 0; color: #64748b;">EN: Unpaid balance before the start date.<br/>HI: चुनी गई तारीख से पहले का बकाया।</p>
              </div>
              <div style="font-size: 10px; line-height: 1.5;">
                <p style="margin: 0; font-weight: 700; color: #059669;">Period Commission:</p>
                <p style="margin: 2px 0 0 0; color: #64748b;">EN: New earnings during these dates.<br/>HI: इन तारीखों के दौरान की कमाई।</p>
              </div>
              <div style="font-size: 10px; line-height: 1.5;">
                <p style="margin: 0; font-weight: 700; color: #0284c7;">Period Paid:</p>
                <p style="margin: 2px 0 0 0; color: #64748b;">EN: Total payments made in this period.<br/>HI: इन तारीखों के दौरान किया गया भुगतान।</p>
              </div>
              <div style="font-size: 10px; line-height: 1.5;">
                <p style="margin: 0; font-weight: 700; color: #b91c1c;">Net Outstanding:</p>
                <p style="margin: 2px 0 0 0; color: #64748b;">EN: Total absolute amount currently due.<br/>HI: अभी देय कुल वास्तविक राशि।</p>
              </div>
            </div>
          </div>

          <div class="footer">
            Generated on ${(() => {
              const now = new Date();
              const d = now.getDate().toString().padStart(2, '0');
              const m = (now.getMonth() + 1).toString().padStart(2, '0');
              const y = now.getFullYear();
              const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
              return `${d}-${m}-${y}, ${time}`;
            })()} • This is a computer generated report.
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 1200);
  };

  const handleEmailLedger = async (dataOverride = null) => {
    if (!checkFeature('Email Support')) {
      toast.info('🚀 Email Ledger is a premium feature. Please upgrade your plan to enable this.', { position: "top-center" });
      return;
    }

    // Defensive check: If called from onClick={handleEmailLedger}, dataOverride will be a React event object.
    // We only want to use dataOverride if it's an actual ledger data object (which has a 'referrals' property).
    const currentData = (dataOverride && dataOverride.referrals) ? dataOverride : ledgerData;

    let targetEmail = selectedDoc?.email;
    
    if (!targetEmail) {
      toast.error("Doctor's email is missing. Please update the profile to send reports.");
      handleEditClick(selectedDoc);
      return;
    }

    setIsEmailing(true);
    const toastId = toast.loading(`Preparing to send report to ${targetEmail}...`);
    try {
      let openingEarned = 0;
      let openingPaid = 0;
      let periodEarned = 0;
      let periodPaid = 0;

      const referrals = currentData?.referrals || [];
      const payments = currentData?.payments || [];

      referrals.forEach(b => {

         const comm = calculateCommission(b, selectedDoc);
         const dStr = b.createdAt ? toLocalDateStr(b.createdAt) : null;
         if (dStr && dStr < ledgerDateRange.start) {
            openingEarned += comm;
         } else if (dStr && dStr <= ledgerDateRange.end) {
            periodEarned += comm;
         }
      });

      payments.forEach(p => {
         const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date || Date.now());
         const dStr = toLocalDateStr(pDate);
         if (dStr < ledgerDateRange.start) {
            openingPaid += p.amount;
         } else if (dStr <= ledgerDateRange.end) {
            periodPaid += p.amount;
         }
      });

      const arrears = openingEarned - openingPaid;
      const totalDue = (openingEarned + periodEarned) - (openingPaid + periodPaid);

      const filteredReferrals = referrals.filter(b => {
        if (!b.createdAt) return true;
        const dateStr = toLocalDateStr(b.createdAt);
        return dateStr >= ledgerDateRange.start && dateStr <= ledgerDateRange.end;
      });

      const filteredPayments = payments.filter(p => {
        const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date || Date.now());
        const dateStr = toLocalDateStr(pDate);
        return dateStr >= ledgerDateRange.start && dateStr <= ledgerDateRange.end;
      });

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
                <div style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Opening Balance</div>
                <div style="font-size: 18px; font-weight: 900; color: #0f172a;">₹${arrears.toFixed(0)}</div>
              </div>
              <div style="flex: 1; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">
                <div style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Earnings</div>
                <div style="font-size: 18px; font-weight: 900; color: #059669;">₹${periodEarned.toFixed(0)}</div>
              </div>
              <div style="flex: 1; padding: 15px; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">
                <div style="font-size: 8px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Paid</div>
                <div style="font-size: 18px; font-weight: 900; color: #0284c7;">₹${periodPaid.toFixed(0)}</div>
              </div>
              <div style="flex: 1; padding: 15px; border: 1px solid #ef4444; border-radius: 12px; text-align: center; background: #fef2f2;">
                <div style="font-size: 8px; font-weight: 800; color: #b91c1c; text-transform: uppercase;">Outstanding</div>
                <div style="font-size: 18px; font-weight: 900; color: #b91c1c;">₹${totalDue.toFixed(0)}</div>
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
              <tfoot style="background: #f8fafc; font-weight: 800; border-top: 2px solid #e2e8f0; color: #0f172a;">
                 <tr>
                    <td colspan="2" style="padding: 10px; text-align: right; font-size: 10px; color: #64748b; text-transform: uppercase;">Total for Period</td>
                    <td style="padding: 10px; text-align: right; font-size: 11px; color: #059669;">₹${periodEarned.toFixed(0)}</td>
                 </tr>
              </tfoot>
            </table>

            <div style="margin-top: 40px; padding: 15px; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0;">
               <p style="margin: 0 0 10px 0; font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase;">Ledger Glossary (शब्दावली)</p>
               <div style="font-size: 9px; line-height: 1.4; color: #475569;">
                  <p style="margin: 0 0 5px 0;"><b>Opening Balance:</b> EN: Unpaid before start date | HI: चुनी गई तारीख से पहले का बकाया।</p>
                  <p style="margin: 0 0 5px 0;"><b>Earnings:</b> EN: New commission earned | HI: इन तारीखों के दौरान की कमाई।</p>
                  <p style="margin: 0 0 5px 0;"><b>Paid:</b> EN: Payments made in this period | HI: इन तारीखों के दौरान किया गया भुगतान।</p>
                  <p style="margin: 0 0 5px 0;"><b>Outstanding:</b> EN: Total absolute amount due | HI: अभी देय कुल वास्तविक राशि।</p>
               </div>
            </div>

            <p style="font-size: 10px; color: #94a3b8; text-align: center; margin-top: 30px;">
              Generated on ${(() => {
                const now = new Date();
                const d = now.getDate().toString().padStart(2, '0');
                const m = (now.getMonth() + 1).toString().padStart(2, '0');
                const y = now.getFullYear();
                const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                return `${d}-${m}-${y}, ${time}`;
              })()} • Lab Mitra Pathology System
            </p>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-grow text-slate-800 animate-in fade-in duration-500">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-brand-dark tracking-tighter flex items-center text-left leading-none">
            <div className="p-2 sm:p-2.5 bg-brand-light rounded-2xl mr-4 shadow-sm border border-brand-primary/10 transition-transform hover:scale-110">
              <Stethoscope className="w-7 h-7 sm:w-8 sm:h-8 text-brand-primary" />
            </div>
            Doctors
          </h1>
          <p className="text-slate-500 mt-2 sm:mt-3 font-medium text-sm sm:text-base italic">Management of referring practitioners & medical networks.</p>
        </div>
        
        <button 
          onClick={() => setShowAddModal(true)}
          className="w-full md:w-auto flex items-center justify-center px-8 py-4 bg-brand-dark text-white rounded-[22px] font-black hover:shadow-2xl hover:shadow-brand-dark/20 hover:-translate-y-1 transition-all duration-300 group active:scale-95 shadow-lg tracking-[0.2em] text-[11px] uppercase whitespace-nowrap"
        >
          <Plus className="w-5 h-5 mr-3 group-hover:rotate-90 transition-transform duration-300 text-brand-primary" />
          Add New Practitioner
        </button>
      </div>

      {/* Sticky Filters Header */}
      <div className="sticky top-0 z-[20] -mx-4 sm:-mx-8 px-4 sm:px-8 py-4 bg-[#F8FAFC]/80 backdrop-blur-xl border-b border-slate-100 mb-8 transition-all">
        <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-6 items-start lg:items-center">
          
          {/* Left Side: Search Bar */}
          <div className="relative flex-grow w-full lg:max-w-2xl group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
            </div>
            <input type="text"
              className="block w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-[22px] focus:ring-4 focus:ring-brand-primary/10 focus:border-brand-primary/30 text-sm font-bold text-brand-dark outline-none transition-all placeholder:text-slate-300 shadow-sm"
              placeholder="Search by practitioner name or medical facility..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          {/* Right Side: Total Stats */}
          <div className="flex items-center gap-3 p-1.5 bg-white border border-slate-200 rounded-[24px] shadow-sm w-full lg:w-auto">
             <div className="px-6 py-2.5 bg-slate-50 border border-slate-100 rounded-[18px] flex items-center gap-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Network Size</span>
                <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-black text-brand-dark tabular-nums shadow-sm">{doctors.length}</span>
             </div>
          </div>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto pr-2 -mr-2 custom-scrollbar min-h-0 bg-white rounded-[32px] shadow-sm border border-slate-100" style={{ maxHeight: 'calc(100vh - 360px)' }}>
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-[#f1f5f9] sticky top-0 z-[10] border-b border-slate-200">
            <tr>
              <th scope="col" className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Practitioner</th>
              <th scope="col" className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Medical Facility</th>
              <th scope="col" className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Structure</th>
              <th scope="col" className="px-8 py-5 text-left text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Status</th>
              <th scope="col" className="px-8 py-5 text-right text-[11px] font-black text-slate-500 uppercase tracking-[0.2em]">Operational Controls</th>
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

      {showAddModal && (
        <div className="fixed inset-0 bg-brand-dark/80 backdrop-blur-3xl flex items-center justify-center p-4 z-[200] animate-in fade-in duration-300">
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
        <div className="fixed inset-0 bg-brand-dark/40 backdrop-blur-xl flex items-center justify-center z-[200] animate-in fade-in duration-500 p-3 md:p-8">
          <div className="bg-white h-full w-full max-w-7xl shadow-[0_32px_128px_rgba(0,0,0,0.5)] rounded-[32px] md:rounded-[48px] flex flex-col relative overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20">
            
            {/* Modal Header - Refined Premium */}
            <div className="px-6 py-4 md:px-8 md:py-6 bg-brand-dark text-white relative overflow-hidden shrink-0">
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
                           {(() => {
                              const clearedCount = ledgerData.referrals.filter(b => b.commissionCleared).length;
                              const totalCount = ledgerData.referrals.length;
                              return (
                                 <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1 rounded-full ${clearedCount > 0 ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300' : 'bg-slate-500/20 border border-slate-500/30 text-slate-300'}`}>
                                    ✅ {clearedCount}/{totalCount} Bills Cleared
                                 </span>
                              );
                           })()}
                        </div>
                     </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                     <button 
                       disabled={isEmailing}
                       onClick={() => handleEmailLedger()}
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
            <div className="flex-grow overflow-y-auto custom-scrollbar p-4 sm:p-6 md:p-8 space-y-8 bg-[#FBFBFE]">
               <div ref={ledgerTopRef} className="scroll-mt-10" />
               
               {/* Controls & Statistics Grid */}
               <div className="space-y-6">
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
                     {!showPaymentForm && (
                        <button 
                           onClick={() => setShowPaymentForm(true)}
                           className="flex items-center justify-center w-full lg:w-auto px-8 py-3.5 bg-brand-dark text-white border border-white/10 shadow-2xl shadow-brand-dark/20 hover:bg-brand-secondary rounded-xl font-black text-[11px] uppercase tracking-[0.2em] transition-all active:scale-95"
                        >
                           Record New Payout
                        </button>
                     )}
                  </div>

                  {/* High-Fidelity Stats Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                     {(() => {
                        const filteredReferrals = ledgerData.referrals.filter(b => {
                           if (!b.createdAt) return true;
                           const dateStr = toLocalDateStr(b.createdAt);
                           return dateStr >= ledgerDateRange.start && dateStr <= ledgerDateRange.end;
                        });

                        const filteredPayments = ledgerData.payments.filter(p => {
                           const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date || Date.now());
                           const dateStr = toLocalDateStr(pDate);
                           return dateStr >= ledgerDateRange.start && dateStr <= ledgerDateRange.end;
                        });

                        let openingEarned = 0;
                        let openingPaid = 0;
                        let periodEarned = 0;
                        let periodPaid = 0;

                        // 1. Calculate Opening Balance (Prior to selected start date)
                        ledgerData.referrals.forEach(b => {
                           const comm = calculateCommission(b, selectedDoc);
                           const dStr = b.createdAt ? toLocalDateStr(b.createdAt) : null;
                           if (dStr && dStr < ledgerDateRange.start) {
                              openingEarned += comm;
                           } else if (dStr && dStr <= ledgerDateRange.end) {
                              periodEarned += comm;
                           }
                        });

                        ledgerData.payments.forEach(p => {
                           const pDate = p.date?.toDate ? p.date.toDate() : new Date(p.date || Date.now());
                           const dStr = toLocalDateStr(pDate);
                           if (dStr < ledgerDateRange.start) {
                              openingPaid += p.amount;
                           } else if (dStr <= ledgerDateRange.end) {
                              periodPaid += p.amount;
                           }
                        });

                        const arrears = openingEarned - openingPaid;
                        const totalDue = (openingEarned + periodEarned) - (openingPaid + periodPaid);

                        return [
                           { label: 'Opening Balance', val: arrears.toFixed(0), unit: 'INR', icon: <Activity className="w-5 h-5"/>, color: arrears > 0 ? 'rose' : 'emerald', help: { en: 'Unpaid balance from before the start date.', hi: 'चुनी गई तारीख से पहले का बकाया।' } },
                           { label: 'Period Earnings', val: periodEarned.toFixed(0), unit: 'INR', icon: <IndianRupee className="w-5 h-5"/>, color: 'emerald', help: { en: 'New commission earned during these dates.', hi: 'इन तारीखों के दौरान की कमाई।' } },
                           { label: 'Period Payouts', val: periodPaid.toFixed(0), unit: 'INR', icon: <CreditCard className="w-5 h-5"/>, color: 'sky', help: { en: 'Total paid to doctor during these dates.', hi: 'इन तारीखों के दौरान किया गया भुगतान।' } },
                           { label: 'Net Outstanding', val: totalDue.toFixed(0), unit: 'INR', icon: <Activity className="w-5 h-5"/>, color: totalDue > 0 ? 'rose' : 'emerald', help: { en: 'Total absolute amount currently due.', hi: 'अभी देय कुल वास्तविक राशि।' } }
                        ].map((stat, i) => (
                           <div key={i} className="bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-[0_10px_40px_rgb(0,0,0,0.02)] transition-all hover:shadow-[0_15px_50px_rgb(0,0,0,0.05)] hover:-translate-y-1 group relative">
                              {/* Decorative Blur Clipper */}
                              <div className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none">
                                 <div className={`absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl -mr-10 -mt-10 transition-opacity opacity-0 group-hover:opacity-40 ${
                                    stat.color === 'emerald' ? 'bg-emerald-500' : 
                                    stat.color === 'sky' ? 'bg-sky-500' : 
                                    stat.color === 'rose' ? 'bg-rose-500' : 'bg-brand-primary'
                                 }`}></div>
                              </div>
                              
                              <div className="relative flex items-center justify-between mb-4">
                                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 ${
                                    stat.color === 'emerald' ? 'bg-emerald-50 text-emerald-500' : 
                                    stat.color === 'sky' ? 'bg-sky-50 text-sky-500' : 
                                    stat.color === 'rose' ? 'bg-rose-50 text-rose-500' : 'bg-brand-light text-brand-primary'
                                 }`}>
                                    {stat.icon}
                                 </div>
                                 <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest tabular-nums">{stat.unit}</div>
                              </div>

                              <div className="relative">
                                 <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">{stat.label}</div>
                                 <div className={`text-2xl font-black tabular-nums tracking-tighter ${
                                    stat.color === 'emerald' ? 'text-emerald-500' : 
                                    stat.color === 'sky' ? 'text-sky-500' : 
                                    stat.color === 'rose' ? 'text-rose-500' : 'text-slate-900'
                                 }`}>₹{stat.val}</div>
                              </div>

                              {/* Repositioned Info Button - Bottom Right */}
                              <div className="group/help absolute bottom-4 right-4 z-20">
                                 <Info className="w-4 h-4 text-slate-400 hover:text-brand-primary cursor-help transition-colors" />
                                 <div className="absolute right-0 bottom-full mb-3 w-56 p-4 bg-slate-900/95 text-white text-[10px] rounded-2xl opacity-0 translate-y-2 group-hover/help:opacity-100 group-hover/help:translate-y-0 pointer-events-none transition-all duration-300 shadow-2xl backdrop-blur-md border border-white/10">
                                    <div className="font-black text-brand-primary uppercase tracking-widest mb-2 pb-2 border-b border-white/5 flex items-center gap-2">
                                       <div className="w-1 h-3 bg-brand-primary rounded-full"></div>
                                       Metric Info
                                    </div>
                                    <div className="space-y-2.5">
                                       <p className="font-bold leading-relaxed">{stat.help.en}</p>
                                       <p className="text-slate-300 font-medium leading-relaxed italic border-t border-white/5 pt-2 font-serif">{stat.help.hi}</p>
                                    </div>
                                    <div className="absolute top-full right-1 transform -translate-y-px">
                                       <div className="border-[6px] border-transparent border-t-slate-900/95"></div>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        ));
                     })()}
                  </div>
               </div>

               {/* New Payout Form - Refined Block */}
               {showPaymentForm && (
                  <div ref={payoutFormRef} className="p-6 md:p-8 bg-white rounded-3xl border border-slate-100 shadow-xl animate-in slide-in-from-top-6 duration-500 relative overflow-hidden scroll-mt-6">
                     <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-[60px] -mr-24 -mt-24"></div>
                     <div className="relative z-10 space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                           <div className="flex items-center gap-3 sm:gap-4">
                              <button 
                                 onClick={() => setShowPaymentForm(false)}
                                 className="w-10 h-10 bg-slate-50 text-slate-300 rounded-xl flex items-center justify-center shadow-inner hover:bg-rose-50 hover:text-rose-600 transition-colors group shrink-0"
                                 title="Cancel Entry"
                              >
                                 <X className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                              </button>
                              <div>
                                 <h4 className="text-sm font-black text-brand-dark uppercase tracking-widest">Record New Payout</h4>
                                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-0.5">Select bills below, then confirm payment</p>
                              </div>
                           </div>
                           <div className="flex items-center justify-between sm:justify-end gap-4 sm:gap-6 w-full sm:w-auto">
                              {selectedBillIds.size > 0 && (
                                 <div className="text-right">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">{selectedBillIds.size} Bill(s) Selected</p>
                                    <p className="text-base sm:text-lg font-black text-brand-dark tabular-nums">₹{ledgerData.referrals.filter(b => selectedBillIds.has(b.id)).reduce((s, b) => s + calculateCommission(b, selectedDoc), 0).toFixed(0)}</p>
                                 </div>
                              )}
                              <button 
                                 onClick={() => setShowPaymentForm(false)} 
                                 className="px-4 sm:px-6 py-2 sm:py-2.5 bg-rose-50 text-rose-600 text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] rounded-xl border border-rose-100 hover:bg-rose-500 hover:text-white transition-all shadow-xl shadow-rose-500/10 active:scale-95 whitespace-nowrap"
                              >
                                 Cancel Payment
                              </button>
                           </div>
                        </div>
                        <form onSubmit={handleRecordPayment} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                           <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Pay Amount (₹)</label>
                              <input required type="number" className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:bg-white focus:border-brand-primary placeholder:text-slate-200 rounded-xl font-black outline-none transition-all shadow-inner text-sm" placeholder="₹ 0.00" value={newPayment.amount} onChange={e => setNewPayment({...newPayment, amount: e.target.value})} />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Payment Mode</label>
                              <select className="w-full px-4 py-3 bg-slate-50 border border-transparent focus:bg-white focus:border-brand-primary rounded-xl font-black outline-none appearance-none cursor-pointer shadow-inner text-sm" value={newPayment.method} onChange={e => setNewPayment({...newPayment, method: e.target.value})}>
                                 {['Cash', 'UPI / PhonePe', 'Bank Transfer', 'Cheque'].map(m => <option key={m}>{m}</option>)}
                              </select>
                           </div>
                           <div className="md:col-span-2 space-y-2">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] ml-2">Reference Note</label>
                              <div className="flex flex-col sm:flex-row gap-3">
                                 <input type="text" className="flex-grow px-4 py-3 bg-slate-50 border border-transparent focus:bg-white focus:border-brand-primary rounded-xl font-bold outline-none transition-all shadow-inner text-sm" placeholder="Optional notes..." value={newPayment.notes} onChange={e => setNewPayment({...newPayment, notes: e.target.value})} />
                                 <button type="submit" disabled={selectedBillIds.size === 0} className="w-full sm:w-auto px-6 py-3 bg-brand-dark text-brand-primary rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:bg-black transition-all active:scale-95 whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed">Save Payout</button>
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
                     {(() => {
                        const finalFilteredReferrals = ledgerData.referrals.filter(b => {
                           if (!b.createdAt) return true;
                           const dateStr = toLocalDateStr(b.createdAt);
                           if (dateStr < ledgerDateRange.start || dateStr > ledgerDateRange.end) return false;
                           
                           if (referralStatusFilter === 'PAID' && !b.commissionCleared) return false;
                           if (referralStatusFilter === 'DUE' && b.commissionCleared) return false;
                           
                           return true;
                        });

                        const dueBills = finalFilteredReferrals.filter(b => !b.commissionCleared);

                        const toggleBillSelection = (id) => {
                           setSelectedBillIds(prev => {
                              const next = new Set(prev);
                              if (next.has(id)) { next.delete(id); } else { next.add(id); }
                              
                              // Recalculate exact sum from ALL referrals
                              const selectedBills = ledgerData.referrals.filter(b => next.has(b.id));
                              const totalComm = selectedBills.reduce((s, b) => s + calculateCommission(b, selectedDoc), 0);
                              
                              setNewPayment(p => ({ ...p, amount: totalComm > 0 ? totalComm.toFixed(0) : '' }));
                              return next;
                           });
                        };

                        const selectAllDue = () => {
                           // Filter from the CURRENT VISIBLE due bills or ALL due bills?
                           // Usually user wants to pay what they SEE.
                           const visibleDue = finalFilteredReferrals.filter(b => !b.commissionCleared);
                           const allDueIds = new Set(visibleDue.map(b => b.id));
                           
                           setSelectedBillIds(allDueIds);
                           const totalComm = visibleDue.reduce((s, b) => s + calculateCommission(b, selectedDoc), 0);
                           setNewPayment(p => ({ ...p, amount: totalComm.toFixed(0) }));
                        };

                        const deselectAll = () => {
                           setSelectedBillIds(new Set());
                           setNewPayment(p => ({ ...p, amount: '' }));
                        };

                        return (
                           <>
                              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                                 <div className="flex items-center gap-6">
                                    <h3 className="text-2xl font-black text-brand-dark tracking-tighter uppercase flex items-center gap-4">
                                       <div className="w-8 h-8 bg-brand-light rounded-lg flex items-center justify-center text-brand-primary">
                                          <Activity className="w-4 h-4" />
                                       </div>
                                       Referral History
                                    </h3>
                                    {showPaymentForm && dueBills.length > 0 && (
                                       <button onClick={selectedBillIds.size === dueBills.length ? deselectAll : selectAllDue} className="px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-white transition-all border border-brand-primary/20 shadow-sm">
                                          {selectedBillIds.size === dueBills.length ? 'Deselect All' : 'Select All Due'}
                                       </button>
                                    )}
                                 </div>
                                 <div className="flex items-center gap-3">
                                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-[0_2px_10px_rgb(0,0,0,0.02)]">
                                       <button onClick={() => setReferralStatusFilter('ALL')} className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${referralStatusFilter === 'ALL' ? 'bg-brand-dark text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-brand-dark'}`}>All</button>
                                       <button onClick={() => setReferralStatusFilter('PAID')} className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${referralStatusFilter === 'PAID' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-emerald-600'}`}>Paid</button>
                                       <button onClick={() => setReferralStatusFilter('DUE')} className={`px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md transition-all ${referralStatusFilter === 'DUE' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 hover:text-amber-600'}`}>Due</button>
                                    </div>
                                    <div className="text-[10px] px-4 py-2.5 bg-white border border-slate-100 rounded-lg text-slate-400 font-black uppercase tracking-widest shadow-[0_2px_10px_rgb(0,0,0,0.02)] hidden sm:block">
                                       {finalFilteredReferrals.length} Records
                                    </div>
                                 </div>
                              </div>
                              <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-[0_10px_40px_rgb(0,0,0,0.02)]">
                                 <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-50">
                                       <thead className="bg-slate-50/50">
                                          <tr>
                                             {showPaymentForm && <th className="pl-6 pr-2 py-6 text-center w-12"></th>}
                                             <th className="px-8 py-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Patient / Date</th>
                                             <th className="px-8 py-6 text-left text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Tests</th>
                                             <th className="px-8 py-6 text-right text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Bill Amount</th>
                                             <th className="px-8 py-6 text-right text-[11px] font-black text-brand-primary uppercase tracking-[0.2em]">Commission</th>
                                             <th className="px-8 py-6 text-center text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Status</th>
                                          </tr>
                                       </thead>
                                       <tbody className="divide-y divide-slate-50">
                                          {finalFilteredReferrals.map((b, i) => {
                                             const isPaid = b.commissionCleared === true;
                                             const isSelected = selectedBillIds.has(b.id);
                                             return (
                                                <tr key={i} className={`transition-colors group ${isSelected ? 'bg-brand-primary/5' : 'hover:bg-slate-50'}`}>
                                                   {showPaymentForm && (
                                                      <td className="pl-6 pr-2 py-6 text-center">
                                                         {!isPaid ? (
                                                            <button type="button" onClick={() => toggleBillSelection(b.id)} className="transition-all hover:scale-110">
                                                               {isSelected ? <CheckSquare className="w-5 h-5 text-brand-primary" /> : <Square className="w-5 h-5 text-slate-300" />}
                                                            </button>
                                                         ) : (
                                                            <span className="text-emerald-400">✔</span>
                                                         )}
                                                      </td>
                                                   )}
                                                   <td className="px-8 py-6">
                                                      <div className="text-sm font-black text-brand-dark uppercase tracking-tight group-hover:text-brand-primary transition-colors">{b.patientName}</div>
                                                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{formatDate(b.createdAt)}</div>
                                                   </td>
                                                   <td className="px-8 py-6 min-w-[250px]">
                                                      <div className="text-[11px] font-black text-slate-500 uppercase leading-relaxed tracking-tight break-words">{b.testNames}</div>
                                                   </td>
                                                   <td className="px-8 py-6 text-right tabular-nums text-sm font-black text-slate-400">₹{b.paidAmount}</td>
                                                   <td className="px-8 py-6 text-right tabular-nums text-base font-black text-brand-dark">₹{calculateCommission(b, selectedDoc).toFixed(0)}</td>
                                                   <td className="px-8 py-6 text-center">
                                                      <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-md ${isPaid ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                                                         {isPaid ? '✔ PAID' : '⏳ DUE'}
                                                      </span>
                                                   </td>
                                                </tr>
                                             )
                                          })}
                                          {finalFilteredReferrals.length === 0 && (
                                             <tr><td colSpan={showPaymentForm ? 6 : 5} className="px-10 py-24 text-center">
                                                <div className="flex flex-col items-center opacity-20">
                                                   <Activity className="w-12 h-12 mb-4" />
                                                   <p className="text-[11px] font-black uppercase tracking-[0.4em]">No Records Found</p>
                                                </div>
                                             </td></tr>
                                          )}
                                       </tbody>
                                    </table>
                                 </div>
                              </div>
                           </>
                        );
                     })()}
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
                        <div className="flex items-center gap-3">
                           {isSuperAdmin && (
                              <button onClick={handleResetPayoutHistory} className="px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md text-rose-500 hover:bg-rose-50 transition-all border border-rose-100 italic">
                                 Reset History
                              </button>
                           )}
                           <div className="text-[10px] px-4 py-2 bg-white border border-slate-100 rounded-full text-slate-400 font-black uppercase tracking-widest shadow-sm">
                              {ledgerData.payments.length} Records
                           </div>
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
