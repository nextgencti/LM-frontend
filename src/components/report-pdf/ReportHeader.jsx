import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';

export default function ReportHeader({ labProfile, styles }) {
  const headerMode = labProfile?.reportSettings?.headerMode || 'text';
  const headerImage = labProfile?.reportSettings?.headerImage;

  if (headerMode === 'none') {
    return null;
  }

  if (headerMode === 'custom' && headerImage) {
    return (
      <View style={styles.headerContainerCustom} fixed>
        <Image src={headerImage} style={styles.headerImage} />
      </View>
    );
  }

  // Default: Text Mode
  return (
    <View style={styles.headerContainer} fixed>
      <View style={styles.headerTextRow}>
        <View style={{ maxWidth: '70%', display: 'flex', flexDirection: 'column' }}>
          <Text style={styles.labName}>
            {labProfile?.labFullName || labProfile?.labName || 'Diagnostic Laboratory'}
          </Text>
          {labProfile?.reportSettings?.showAddress !== false && labProfile?.address ? (
            <Text style={styles.labDetail}>{labProfile.address}</Text>
          ) : null}
          {labProfile?.reportSettings?.showPhone !== false && (labProfile?.phone || labProfile?.mobile) ? (
            <Text style={styles.labDetail}>{labProfile.phone || labProfile.mobile}</Text>
          ) : null}
          {labProfile?.reportSettings?.showEmail !== false && labProfile?.email ? (
            <Text style={styles.labDetail}>{labProfile.email}</Text>
          ) : null}
        </View>
        <View style={styles.reportBadgeContainer}>
          <Text style={styles.reportBadgeText}>Diagnostic Report</Text>
        </View>
      </View>
      <View style={styles.headerLine} />
    </View>
  );
}
