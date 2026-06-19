import React from 'react';
import { View, Text } from '@react-pdf/renderer';

export default function TestCategorySection({ testTit, catName, samType, styles }) {
  return (
    <View style={styles.testCategoryHeader} wrap={false}>
      <View style={styles.testCategoryHeaderLeft}>
        <Text style={styles.testTitleText}>{testTit}</Text>
        <Text style={styles.testCategoryText}>Category: {catName || 'General'}</Text>
      </View>
      <Text style={styles.testSampleText}>Sample: {samType || 'N/A'}</Text>
    </View>
  );
}
