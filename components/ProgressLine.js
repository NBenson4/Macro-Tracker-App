import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ProgressLine({ label, current, target, unit }) {
  const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressText}>
          {current} / {target} {unit}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  progressWrap: {
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontWeight: '800',
    color: '#172033',
  },
  progressText: {
    color: '#6b7280',
    fontWeight: '600',
  },
  progressTrack: {
    height: 10,
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#172033',
  },
});