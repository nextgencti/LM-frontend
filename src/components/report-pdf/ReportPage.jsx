import React from 'react';
import { Page } from '@react-pdf/renderer';
import ReportHeader from './ReportHeader';
import ReportFooter from './ReportFooter';
import WatermarkLayer from './WatermarkLayer';

export default function ReportPage({ labProfile, qrUrl, styles, children }) {
  return (
    <Page size="A4" style={styles.page}>
      {/* Repeating background watermark */}
      <WatermarkLayer labProfile={labProfile} styles={styles} />

      {/* Repeating page header */}
      <ReportHeader labProfile={labProfile} styles={styles} />

      {/* Main flowable page content */}
      {children}

      {/* Repeating page footer */}
      <ReportFooter labProfile={labProfile} qrUrl={qrUrl} styles={styles} />
    </Page>
  );
}
