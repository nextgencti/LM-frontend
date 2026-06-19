import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';

export default function ReportFooter({ labProfile, qrUrl, styles }) {
  const footerMode = labProfile?.reportSettings?.footerMode || 'text';
  const footerImage = labProfile?.reportSettings?.footerImage;

  if (footerMode === 'none') {
    return (
      <View style={{ position: 'absolute', bottom: 10, left: 0, right: 0, alignItems: 'center' }} fixed>
        <Text 
          style={{
            fontSize: 7.5,
            color: '#9ca3af',
            fontFamily: 'Inter',
            fontWeight: 700
          }}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>
    );
  }

  if (footerMode === 'custom' && footerImage) {
    return (
      <View style={styles.footerContainerCustom} fixed>
        <Image src={footerImage} style={styles.footerImage} />
        {/* Dynamic Page Number Overlay */}
        <Text 
          style={{
            position: 'absolute',
            bottom: 12,
            right: 35,
            fontSize: 7.5,
            color: '#ffffff',
            fontFamily: 'Inter',
            fontWeight: 700
          }}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </View>
    );
  }

  return (
    <View style={styles.footerContainer} fixed>
      {/* Dynamic Page Number */}
      <Text 
        style={{
          textAlign: 'center',
          fontSize: 7.5,
          color: '#6b7280',
          fontFamily: 'Inter',
          fontWeight: 700
        }}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}
