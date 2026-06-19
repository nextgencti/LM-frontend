import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';

const formatDate = (ts, includeTime = false) => {
  if (!ts) return '';
  let d;
  // Handle Firebase SDK object, serialized JSON, or standard Date
  if (ts._seconds) { d = new Date(ts._seconds * 1000); } 
  else if (ts.seconds) { d = new Date(ts.seconds * 1000); } 
  else if (typeof ts.toDate === 'function') { d = ts.toDate(); } 
  else { d = new Date(ts); }
  
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', {
     day: '2-digit', month: '2-digit', year: 'numeric',
     ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: true } : {})
  }).replace(',', '');
};

const getDisplayId = (id) => id ? String(id).split('_').pop() : '--';

export default function PatientInfoSection({ reportData, patientData, doctorData, bookingData, qrUrl, styles }) {
  const encodedQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrUrl || 'https://labmitra.com')}`;
  const statusVal = ((reportData.status === 'Delivered' || reportData.status === 'Final' || (reportData.results && reportData.results.length > 0)) ? 'Final' : 'In Progress');

  return (
    <View style={styles.patientInfoContainer} fixed>
      <View style={styles.patientInfoGrid}>
        {/* Left Column */}
        <View style={styles.gridColumn}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Name</Text>
            <Text style={[styles.infoValue, { textTransform: 'uppercase' }]}>: {reportData.patientName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Age/Gender</Text>
            <Text style={styles.infoValue}>
              : {patientData?.age || reportData.patientAge || '??'} Y / {patientData?.gender || reportData.patientGender || '--'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Referred By</Text>
            <Text style={[styles.infoValue, { textTransform: 'uppercase' }]}>
              : {doctorData?.name || reportData.doctorName || 'Self'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Patient ID</Text>
            <Text style={styles.infoValue}>
              : {getDisplayId(patientData?.patientId || reportData?.patientId || reportData?.patient_id || patientData?.id)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Report ID</Text>
            <Text style={styles.infoValue}>
              : {reportData.reportId || reportData.bookingNo || reportData.bookingId || '--'}
            </Text>
          </View>
        </View>

        {/* Right Column */}
        <View style={styles.gridColumn}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reg. Date</Text>
            <Text style={styles.infoValue}>: {formatDate(bookingData?.createdAt || reportData.createdAt, true)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Received Date</Text>
            <Text style={styles.infoValue}>: {formatDate(bookingData?.receptionDate || reportData.createdAt, true)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Collection Date</Text>
            <Text style={styles.infoValue}>: {formatDate(bookingData?.collectionDate || reportData.createdAt, true)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Report Date</Text>
            <Text style={styles.infoValue}>: {formatDate(reportData.updatedAt || reportData.createdAt, true)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text style={[styles.infoValue, { color: statusVal === 'Final' ? '#047857' : '#b91c1c', fontWeight: 'bold' }]}>
              : {statusVal}
            </Text>
          </View>
        </View>
      </View>

      {/* QR Code Column */}
      <View style={styles.qrColumn}>
        <Image src={encodedQrUrl} style={styles.qrCodeImage} />
        <Text style={styles.qrLabel}>Scan to Verify</Text>
      </View>
    </View>
  );
}
export { formatDate, getDisplayId };
