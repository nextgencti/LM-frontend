import React from 'react';
import { View, Text } from '@react-pdf/renderer';

const getFlag = (val, rangeStr) => {
  if (!val || !rangeStr) return '';
  const v = parseFloat(val);
  if (isNaN(v)) return '';
  const range = String(rangeStr).toLowerCase();
  
  const rangeMatch = range.match(/([\d\.]+)\s*-\s*([\d\.]+)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]), max = parseFloat(rangeMatch[2]);
    if (v < min) return 'L';
    if (v > max) return 'H';
    return '';
  }
  const ltMatch = range.match(/<\s*([\d\.]+)/);
  if (ltMatch) return v >= parseFloat(ltMatch[1]) ? 'H' : '';
  const gtMatch = range.match(/>\s*([\d\.]+)/);
  if (gtMatch) return v <= parseFloat(gtMatch[1]) ? 'L' : '';
  return '';
};

export default function ParameterTable({ params, isTabular = false, styles }) {
  return (
    <View style={isTabular ? styles.tabularTableContainer : styles.standardTableContainer}>
      {/* Table Headers */}
      {isTabular && (
        <View style={styles.tabularTableHeader} fixed>
          <Text style={[styles.colParam, styles.headerText]}>Parameter</Text>
          <Text style={[styles.colResult, styles.headerText]}>Result</Text>
          <Text style={[styles.colFlag, styles.headerText, { textAlign: 'center' }]}>Flag</Text>
          <Text style={[styles.colUnit, styles.headerText]}>Unit</Text>
          <Text style={[styles.colRange, styles.headerText, { textAlign: 'right' }]}>Ref. Range</Text>
        </View>
      )}

      {/* Rows */}
      {params.map((res, index) => {
        const flag = getFlag(res.value, res.range);
        const isAbnormal = flag === 'H' || flag === 'L';
        const valStr = String(res.value || '').toUpperCase();
        
        const isPositive = valStr.includes('POSITIVE') || (valStr.includes('REACTIVE') && !valStr.includes('NON-REACTIVE'));
        const isNegative = valStr.includes('NEGATIVE') || valStr.includes('NON-REACTIVE');

        // Color coding logic matching Puppeteer styling
        let valueColor = '#111827'; // slate-900 (normal)
        let valueWeight = 500;
        
        if (isPositive) {
          valueColor = '#dc2626'; // red-600 (rose-600)
          valueWeight = 700;
        } else if (isNegative) {
          valueColor = '#059669'; // emerald-600
          valueWeight = 700;
        } else if (isAbnormal) {
          valueColor = flag === 'H' ? '#dc2626' : '#2563eb'; // High -> Red, Low -> Blue
          valueWeight = 700;
        } else if (res.value) {
          valueColor = '#111827';
          valueWeight = 500;
        }

        const flagColor = flag === 'H' ? '#dc2626' : flag === 'L' ? '#2563eb' : '#059669';

        return (
          <View 
            key={index} 
            style={isTabular ? styles.tabularTableRow : styles.standardTableRow} 
            wrap={false}
          >
            {/* Parameter Name */}
            <Text style={[styles.colParam, isAbnormal ? styles.textBold : styles.textMedium]}>
              {res.parameter || res.name}
            </Text>

            {/* Parameter Value */}
            <Text style={[styles.colResult, { color: valueColor, fontWeight: valueWeight, fontFamily: 'Inter' }]}>
              {res.value || '-'}
            </Text>

            {/* Flag Column */}
            <Text style={[styles.colFlag, { color: flagColor, fontWeight: 700, textAlign: 'center' }]}>
              {flag || ''}
            </Text>

            {/* Unit Column */}
            <Text style={[styles.colUnit, styles.textMedium]}>
              {res.unit || '-'}
            </Text>

            {/* Reference Range Column */}
            <Text style={[styles.colRange, isAbnormal ? styles.textBold : styles.textMedium, { textAlign: 'right' }]}>
              {res.range || res.normalRange || '-'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
export { getFlag };
