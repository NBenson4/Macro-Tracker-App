import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MacroBox({ label, value, unit }) {
  return (
    <View style={styles.macroBox}>
      <Text style={styles.macroValue}>{value}</Text>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={styles.macroUnit}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  macroBox: {
    flexBasis: '47%',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    padding: 14,
  },
  macroValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#172033',
  },
  macroLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4b5563',
  },
  macroUnit: {
    fontSize: 12,
    color: '#9ca3af',
  },
});