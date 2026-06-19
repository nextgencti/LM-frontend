import React from 'react';
import { View, Text } from '@react-pdf/renderer';

export default function WidalTable({ params, styles }) {
  const titrs = ["1:20", "1:40", "1:80", "1:160", "1:320"];

  return (
    <View style={styles.tabularTableContainer} wrap={false}>
      {/* Grid Header */}
      <View style={[styles.tabularTableHeader, { paddingVertical: 0, paddingHorizontal: 0 }]}>
        <View style={[styles.colWidalParam, { paddingVertical: 4, paddingHorizontal: 6, borderRightWidth: 1, borderRightColor: '#6b7280' }]}>
          <Text style={styles.headerText}>Parameter</Text>
        </View>
        {titrs.map((t, idx) => (
          <View 
            key={idx} 
            style={[
              styles.colWidalTiter, 
              { 
                paddingVertical: 4, 
                paddingHorizontal: 2, 
                borderRightWidth: idx === titrs.length - 1 ? 0 : 1, 
                borderRightColor: '#6b7280', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
              }
            ]}
          >
            <Text style={styles.headerText}>{t}</Text>
          </View>
        ))}
      </View>

      {/* Grid Rows */}
      {params.map((res, index) => {
        let vm_grid = {};
        try {
          vm_grid = JSON.parse(res.value || '{}');
        } catch (e) {}

        return (
          <View key={index} style={[styles.tabularTableRow, { paddingVertical: 0, paddingHorizontal: 0 }]} wrap={false}>
            {/* Parameter Label */}
            <View style={[styles.colWidalParam, { paddingVertical: 4, paddingHorizontal: 6, borderRightWidth: 1, borderRightColor: '#6b7280' }]}>
              <Text style={styles.textMedium}>{res.parameter || res.name}</Text>
            </View>

            {/* Titer values */}
            {titrs.map((t, tidx) => {
              const v_g = vm_grid[t] || '-';
              
              let titerColor = '#9ca3af'; // gray-400 (inactive)
              let titerWeight = 500;

              const vUpper = String(v_g).toUpperCase();
              if (vUpper === 'REACTIVE') {
                titerColor = '#dc2626'; // red-600
                titerWeight = 700;
              } else if (vUpper === 'WEAKLY') {
                titerColor = '#f87171'; // red-400
                titerWeight = 700;
              } else if (v_g !== '-' && v_g !== '') {
                titerColor = '#dc2626'; // any positive/reactive titer
                titerWeight = 700;
              }

              return (
                <View 
                  key={tidx} 
                  style={[
                    styles.colWidalTiter, 
                    { 
                      paddingVertical: 4, 
                      paddingHorizontal: 2, 
                      borderRightWidth: tidx === titrs.length - 1 ? 0 : 1, 
                      borderRightColor: '#6b7280', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center' 
                    }
                  ]}
                >
                  <Text style={{ color: titerColor, fontWeight: titerWeight, fontFamily: 'Inter', fontSize: 10 }}>
                    {v_g}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
