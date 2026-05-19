import React from 'react';
import { View, StyleSheet } from 'react-native';
import MacroBox from './MacroBox';

export default function MacroGrid({ data }) {
  return (
    <View style={styles.macroGrid}>
      <MacroBox label="Calories" value={data.calories} unit="cal" />
      <MacroBox label="Protein" value={data.protein} unit="g" />
      <MacroBox label="Carbs" value={data.carbs} unit="g" />
      <MacroBox label="Fat" value={data.fat} unit="g" />
    </View>
  );
}

const styles = StyleSheet.create({
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});