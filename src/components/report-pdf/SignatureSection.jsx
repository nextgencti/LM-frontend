import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';

export default function SignatureSection({ labProfile, styles }) {
  if (!labProfile?.pathologistName) return null;

  return (
    <View style={styles.signatureContainer} wrap={false}>
      <View style={styles.signatureBlock}>
        {labProfile?.pathologistSignature ? (
          <Image src={labProfile.pathologistSignature} style={styles.signatureImage} />
        ) : (
          <View style={{ height: 35 }} />
        )}
        <View style={styles.signatureLine} />
        <Text style={styles.signatureName}>{labProfile.pathologistName}</Text>
        {labProfile?.pathologistDesignation ? (
          <Text style={styles.signatureDesignation}>{labProfile.pathologistDesignation}</Text>
        ) : null}
      </View>
    </View>
  );
}
