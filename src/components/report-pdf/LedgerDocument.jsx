import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register Inter font weights from gstatic TTF files
Font.register({
  family: 'Inter',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf', fontWeight: 500 },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf', fontWeight: 700 },
    { src: 'https://fonts.gstatic.com/s/inter/v20/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYMZg.ttf', fontWeight: 900 }
  ]
});

// Register Poppins for rendering Hindi text correctly
Font.register({
  family: 'Poppins',
  fonts: [
    { src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Regular.ttf', fontWeight: 400 },
    { src: 'https://raw.githubusercontent.com/google/fonts/main/ofl/poppins/Poppins-Bold.ttf', fontWeight: 700 }
  ]
});

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 45,
    paddingHorizontal: 30,
    fontFamily: 'Inter',
    fontSize: 9,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  header: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  labInfo: {
    flexDirection: 'column',
    flex: 1.5,
  },
  labName: {
    fontSize: 18,
    fontWeight: 900,
    color: '#020617',
    textTransform: 'uppercase',
  },
  labSubtitle: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: 600,
    marginTop: 2,
  },
  periodInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  periodLabel: {
    fontSize: 8,
    fontWeight: 800,
    color: '#94a3b8',
    textTransform: 'uppercase',
  },
  periodValue: {
    fontSize: 10,
    fontWeight: 700,
    color: '#1e293b',
    marginTop: 2,
  },
  docInfo: {
    marginBottom: 15,
  },
  docName: {
    fontSize: 14,
    fontWeight: 900,
    color: '#0f172a',
  },
  docSub: {
    fontSize: 8.5,
    fontWeight: 700,
    color: '#10b981',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 7,
    fontWeight: 800,
    textTransform: 'uppercase',
    color: '#94a3b8',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 12,
    fontWeight: 900,
    color: '#0f172a',
  },
  sectionTitle: {
    fontSize: 9.5,
    fontWeight: 900,
    textTransform: 'uppercase',
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
    paddingLeft: 8,
    marginTop: 15,
    marginBottom: 8,
    color: '#1e293b',
  },
  table: {
    width: '100%',
    marginBottom: 15,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  thText: {
    fontSize: 7.5,
    fontWeight: 800,
    textTransform: 'uppercase',
    color: '#64748b',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 5,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tdText: {
    fontSize: 8,
    fontWeight: 500,
    color: '#334155',
  },
  textRight: {
    textAlign: 'right',
  },
  bold: {
    fontWeight: 700,
  },
  colPatient: { flex: 2.2 },
  colDate: { flex: 1.2 },
  colTests: { flex: 2.6 },
  colAmount: { flex: 1.2, textAlign: 'right' },
  colComm: { flex: 1.2, textAlign: 'right' },
  colMethod: { flex: 1.5 },
  colNotes: { flex: 2.5 },
  colAmountPaid: { flex: 1.5, textAlign: 'right' },
  tableFooter: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderTopWidth: 1.5,
    borderTopColor: '#cbd5e1',
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  footerLabel: {
    flex: 6,
    textAlign: 'right',
    fontSize: 8,
    fontWeight: 800,
    textTransform: 'uppercase',
    color: '#64748b',
    paddingRight: 10,
  },
  footerValAmount: {
    flex: 1.2,
    textAlign: 'right',
    fontSize: 8.5,
    fontWeight: 800,
    color: '#0f172a',
  },
  footerValComm: {
    flex: 1.2,
    textAlign: 'right',
    fontSize: 8.5,
    fontWeight: 800,
    color: '#059669',
  },
  glossary: {
    marginTop: 15,
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  glossaryTitle: {
    fontFamily: 'Poppins',
    fontSize: 8,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  glossaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  glossaryItem: {
    width: '47%',
  },
  glossaryItemTitle: {
    fontSize: 7.5,
    fontWeight: 700,
    color: '#1e293b',
  },
  glossaryItemDesc: {
    fontFamily: 'Poppins',
    fontSize: 6.5,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 1.3,
  },
  footerText: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    textAlign: 'center',
    fontSize: 7.5,
    color: '#94a3b8',
    fontWeight: 600,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
  }
});

const formatDate = (date) => {
   if (!date) return 'N/A';
   const d = date.toDate ? date.toDate() : new Date(date);
   return d.toLocaleDateString('en-GB').replace(/\//g, '-');
};

export default function LedgerDocument({ 
  selectedDoc, 
  ledgerDateRange, 
  subscription, 
  arrears, 
  periodEarned, 
  periodPaid, 
  totalDue, 
  filteredReferrals, 
  filteredPayments,
  calculateCommission 
}) {
  return (
    <Document title={`Doctor Ledger - ${selectedDoc?.name || 'Doctor'}`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.labInfo}>
            <Text style={styles.labName}>{subscription?.labFullName || subscription?.labName || 'Pathology Laboratory'}</Text>
            <Text style={styles.labSubtitle}>Performance & Commission Ledger Report</Text>
          </View>
          <View style={styles.periodInfo}>
            <Text style={styles.periodLabel}>REPORT PERIOD</Text>
            <Text style={styles.periodValue}>
              {formatDate(ledgerDateRange.start)} - {formatDate(ledgerDateRange.end)}
            </Text>
          </View>
        </View>

        {/* Doctor Information */}
        <View style={styles.docInfo}>
          <Text style={styles.docName}>{selectedDoc?.name || 'N/A'}</Text>
          <Text style={styles.docSub}>
            {selectedDoc?.clinic || 'Independent Practice'} • ID: {selectedDoc?.doctorId || 'N/A'} • COMMISSION RATE: {selectedDoc?.commissionValue > 0 ? (selectedDoc?.commissionType === 'Percentage' ? `${selectedDoc?.commissionValue}%` : `₹${selectedDoc?.commissionValue} Fixed`) : '—'}
          </Text>
        </View>

        {/* Summary Grid */}
        <View style={styles.summaryGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Opening Balance</Text>
            <Text style={styles.statValue}>₹{arrears.toFixed(0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Period Commission</Text>
            <Text style={styles.statValue}>₹{periodEarned.toFixed(0)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Period Paid</Text>
            <Text style={styles.statValue}>₹{periodPaid.toFixed(0)}</Text>
          </View>
          <View style={[styles.statCard, { borderColor: '#fca5a5' }]}>
            <Text style={[styles.statLabel, { color: '#ef4444' }]}>Net Outstanding</Text>
            <Text style={[styles.statValue, { color: '#ef4444' }]}>₹{totalDue.toFixed(0)}</Text>
          </View>
        </View>

        {/* Referral Detailed Record */}
        <View>
          <Text style={styles.sectionTitle}>Referral Detailed Record</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.thText, styles.colPatient]}>Patient Name</Text>
              <Text style={[styles.thText, styles.colDate]}>Date</Text>
              <Text style={[styles.thText, styles.colTests]}>Tests</Text>
              <Text style={[styles.thText, styles.colAmount]}>Paid Amount</Text>
              <Text style={[styles.thText, styles.colComm]}>Commission</Text>
            </View>
            
            {filteredReferrals.map((b, idx) => (
              <View key={idx} style={styles.tableRow} wrap={false}>
                <Text style={[styles.tdText, styles.colPatient, styles.bold]}>{b.patientName}</Text>
                <Text style={[styles.tdText, styles.colDate]}>{formatDate(b.createdAt)}</Text>
                <Text style={[styles.tdText, styles.colTests]}>{b.testNames}</Text>
                <Text style={[styles.tdText, styles.colAmount]}>₹{b.paidAmount}</Text>
                <Text style={[styles.tdText, styles.colComm, styles.bold]}>
                  ₹{calculateCommission(b, selectedDoc).toFixed(1)}
                </Text>
              </View>
            ))}
            
            <View style={styles.tableFooter}>
              <Text style={styles.footerLabel}>Total for Period</Text>
              <Text style={styles.footerValAmount}>
                ₹{filteredReferrals.reduce((s, b) => s + (parseFloat(b.paidAmount) || 0), 0).toFixed(0)}
              </Text>
              <Text style={styles.footerValComm}>₹{periodEarned.toFixed(0)}</Text>
            </View>
          </View>
        </View>

        {/* Payment & Payout History */}
        <View>
          <Text style={styles.sectionTitle}>Payment & Payout History</Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.thText, styles.colDate]}>Date</Text>
              <Text style={[styles.thText, styles.colMethod]}>Method</Text>
              <Text style={[styles.thText, styles.colNotes]}>Notes / Remarks</Text>
              <Text style={[styles.thText, styles.colAmountPaid]}>Amount Paid</Text>
            </View>
            
            {filteredPayments.map((p, idx) => (
              <View key={idx} style={styles.tableRow} wrap={false}>
                <Text style={[styles.tdText, styles.colDate, styles.bold]}>{formatDate(p.date)}</Text>
                <Text style={[styles.tdText, styles.colMethod, styles.bold, { color: '#0ea5e9', textTransform: 'uppercase' }]}>{p.method}</Text>
                <Text style={[styles.tdText, styles.colNotes]}>{p.notes || '—'}</Text>
                <Text style={[styles.tdText, styles.colAmountPaid, styles.bold]}>₹{p.amount.toFixed(0)}</Text>
              </View>
            ))}
            
            {filteredPayments.length === 0 && (
              <View style={[styles.tableRow, { justifyContent: 'center', paddingVertical: 20 }]}>
                <Text style={[styles.tdText, { color: '#94a3b8' }]}>No payout records found for this period.</Text>
              </View>
            )}
          </View>
        </View>

        {/* Glossary */}
        <View style={styles.glossary} wrap={false}>
          <Text style={styles.glossaryTitle}>Ledger Terms Glossary / शब्दावली</Text>
          <View style={styles.glossaryGrid}>
            <View style={styles.glossaryItem}>
              <Text style={styles.glossaryItemTitle}>Opening Balance (Arrears):</Text>
              <Text style={styles.glossaryItemDesc}>
                EN: Unpaid balance before the start date.{"\n"}HI: चुनी गई तारीख से पहले का बकाया।
              </Text>
            </View>
            <View style={styles.glossaryItem}>
              <Text style={styles.glossaryItemTitle}>Period Commission:</Text>
              <Text style={styles.glossaryItemDesc}>
                EN: New earnings during these dates.{"\n"}HI: इन तारीखों के दौरान की कमाई।
              </Text>
            </View>
            <View style={styles.glossaryItem}>
              <Text style={styles.glossaryItemTitle}>Period Paid:</Text>
              <Text style={styles.glossaryItemDesc}>
                EN: Total payments made in this period.{"\n"}HI: इन तारीखों के दौरान किया गया भुगतान।
              </Text>
            </View>
            <View style={styles.glossaryItem}>
              <Text style={styles.glossaryItemTitle}>Net Outstanding:</Text>
              <Text style={styles.glossaryItemDesc}>
                EN: Total absolute amount currently due.{"\n"}HI: अभी देय कुल वास्तविक राशि।
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footerText} fixed>
          Generated on {(() => {
            const now = new Date();
            const d = now.getDate().toString().padStart(2, '0');
            const m = (now.getMonth() + 1).toString().padStart(2, '0');
            const y = now.getFullYear();
            const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            return `${d}-${m}-${y}, ${time}`;
          })()} • This is a computer generated report.
        </Text>
      </Page>
    </Document>
  );
}
