import React from 'react';
import { View, Text, Image } from '@react-pdf/renderer';

export default function WatermarkLayer({ labProfile, styles }) {
  const watermark = labProfile?.reportSettings?.watermark;
  
  if (watermark?.enabled === false) return null;
  if (!watermark?.enabled && !watermark?.text && !watermark?.image) return null;

  const opacity = watermark.opacity !== undefined ? watermark.opacity : 0.15;
  const rotation = watermark.rotation !== undefined ? watermark.rotation : -45;

  if (watermark.type === 'image' && watermark.image) {
    return (
      <View style={styles.watermarkContainer} fixed>
        <Image
          src={watermark.image}
          style={{
            opacity,
            width: '60%',
            height: 'auto',
            transform: `rotate(${rotation}deg)`,
          }}
        />
      </View>
    );
  }

  const text = watermark.text || 'LAB MITRA';
  const fontSize = text.length > 15 ? 40 : 55;

  return (
    <View style={styles.watermarkContainer} fixed>
      <View style={[styles.watermarkTextBorder, { transform: `rotate(${rotation}deg)`, opacity }]}>
        <Text style={[styles.watermarkText, { fontSize }]}>
          {text}
        </Text>
      </View>
    </View>
  );
}
