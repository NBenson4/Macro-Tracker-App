import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function ButtonGroup({ options, selected, onSelect }) {
  return (
    <View style={styles.buttonGroup}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[
            styles.optionButton,
            selected === option.value && styles.optionButtonActive,
          ]}
          onPress={() => onSelect(option.value)}
        >
          <Text
            style={[
              styles.optionText,
              selected === option.value && styles.optionTextActive,
            ]}
          >
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  buttonGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  optionButton: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  optionButtonActive: {
    backgroundColor: '#172033',
  },
  optionText: {
    color: '#374151',
    fontWeight: '700',
  },
  optionTextActive: {
    color: '#ffffff',
  },
});