import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function FoodSearchResults({ results, onAddFood }) {
  if (!results.length) {
    return null;
  }

  return (
    <View style={styles.resultsWrap}>
      {results.map((food) => (
        <TouchableOpacity
          key={food.id}
          style={styles.resultCard}
          onPress={() => onAddFood(food)}
        >
          <View>
            <Text style={styles.foodName}>{food.name}</Text>
            <Text style={styles.foodMeta}>{food.brand || 'USDA FoodData Central'}</Text>
            <Text style={styles.foodMeta}>
              {food.calories} cal • P {food.protein}g • C {food.carbs}g • F {food.fat}g
            </Text>
          </View>
          <Text style={styles.addText}>Add</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  resultsWrap: {
    marginTop: 10,
  },
  resultCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  foodName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#172033',
  },
  foodMeta: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  addText: {
    fontWeight: '900',
    color: '#172033',
  },
});