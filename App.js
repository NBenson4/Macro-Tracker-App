import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Input from './components/Input';
import ButtonGroup from './components/ButtonGroup';
import MacroGrid from './components/MacroGrid';
import ProgressLine from './components/ProgressLine';
import FoodSearchResults from './components/FoodSearchResults';

const USDA_API_KEY = 'DEVELOPMENT_KEY_REMOVED';

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

const GOAL_ADJUSTMENTS = {
  cut: -500,
  maintain: 0,
  bulk: 300,
};

function calculateMacros({ sex, age, heightIn, weightLb, activity, goal }) {
  const weightKg = weightLb / 2.20462;
  const heightCm = heightIn * 2.54;
  const sexAdjustment = sex === 'female' ? -161 : 5;

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexAdjustment;
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activity];
  const calories = Math.round(tdee + GOAL_ADJUSTMENTS[goal]);

  const protein = Math.round(weightLb * 1.0);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return { calories, protein, carbs, fat };
}

const starterFoods = [
  {
    id: '1',
    name: 'Chicken Breast',
    serving: '4 oz',
    calories: 185,
    protein: 35,
    carbs: 0,
    fat: 4,
  },
  {
    id: '2',
    name: 'White Rice',
    serving: '1 cup',
    calories: 205,
    protein: 4,
    carbs: 45,
    fat: 0,
  },
  {
    id: '3',
    name: 'Egg',
    serving: '1 egg',
    calories: 70,
    protein: 6,
    carbs: 1,
    fat: 5,
  },
];

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();

  const [storageLoaded, setStorageLoaded] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [lastBarcode, setLastBarcode] = useState('');

  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [scannedProduct, setScannedProduct] = useState(null);

  const [search, setSearch] = useState('');
  const [foodLog, setFoodLog] = useState([]);

  const [usdaSearch, setUsdaSearch] = useState('');
  const [usdaResults, setUsdaResults] = useState([]);
  const [usdaLoading, setUsdaLoading] = useState(false);
  const [usdaError, setUsdaError] = useState('');

  const [profile, setProfile] = useState({
    sex: 'male',
    age: '22',
    heightIn: '74',
    weightLb: '220',
    activity: 'active',
    goal: 'maintain',
  });

  useEffect(() => {
    async function loadSavedData() {
      try {
        const savedProfile = await AsyncStorage.getItem('macroTrackerProfile');
        const savedFoodLog = await AsyncStorage.getItem('macroTrackerFoodLog');

        console.log('Saved profile:', savedProfile);
        console.log('Saved food log:', savedFoodLog);

        if (savedProfile) {
          setProfile(JSON.parse(savedProfile));
        }

        if (savedFoodLog) {
          setFoodLog(JSON.parse(savedFoodLog));
        }
      } catch (error) {
        console.log('Error loading saved data:', error);
      } finally {
        setStorageLoaded(true);
      }
    }

    loadSavedData();
  }, []);

  useEffect(() => {
    if (!storageLoaded) return;

    async function saveData() {
      try {
        await AsyncStorage.setItem('macroTrackerProfile', JSON.stringify(profile));
        await AsyncStorage.setItem('macroTrackerFoodLog', JSON.stringify(foodLog));

        console.log('Saved food log successfully:', foodLog);
      } catch (error) {
        console.log('Error saving data:', error);
      }
    }

    saveData();
  }, [profile, foodLog, storageLoaded]);

  const macroGoals = useMemo(() => {
    return calculateMacros({
      sex: profile.sex,
      age: Number(profile.age),
      heightIn: Number(profile.heightIn),
      weightLb: Number(profile.weightLb),
      activity: profile.activity,
      goal: profile.goal,
    });
  }, [profile]);

  const totals = foodLog.reduce(
    (sum, food) => ({
      calories: sum.calories + food.calories,
      protein: sum.protein + food.protein,
      carbs: sum.carbs + food.carbs,
      fat: sum.fat + food.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const filteredFoods = starterFoods.filter((food) =>
    food.name.toLowerCase().includes(search.toLowerCase())
  );

  function updateProfile(field, value) {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function addFood(food) {
    setFoodLog((current) => [
      ...current,
      {
        ...food,
        logId: Date.now().toString(),
      },
    ]);
  }

  function removeFood(logId) {
    setFoodLog((current) => current.filter((food) => food.logId !== logId));
  }

  async function openScanner() {
    if (!permission?.granted) {
      const response = await requestPermission();

      if (!response.granted) {
        Alert.alert('Camera Permission Needed');
        return;
      }
    }

    setScanned(false);
    setScannerOpen(true);
  }

  async function fetchProductByBarcode(barcode) {
    setApiLoading(true);
    setApiError('');
    setScannedProduct(null);

    try {
      const fields = ['product_name', 'brands', 'serving_size', 'nutriments'].join(',');

      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${fields}`
      );

      const data = await response.json();

      if (data.status !== 1 || !data.product) {
        setApiError('Product not found.');
        return;
      }

      const product = data.product;
      const nutriments = product.nutriments || {};

      const foodFromApi = {
        id: barcode,
        name: product.product_name || 'Unknown Product',
        brand: product.brands || '',
        serving: product.serving_size || '100 g',
        calories: Math.round(
          nutriments['energy-kcal_serving'] ?? nutriments['energy-kcal_100g'] ?? 0
        ),
        protein: Math.round(nutriments.proteins_serving ?? nutriments.proteins_100g ?? 0),
        carbs: Math.round(
          nutriments.carbohydrates_serving ?? nutriments.carbohydrates_100g ?? 0
        ),
        fat: Math.round(nutriments.fat_serving ?? nutriments.fat_100g ?? 0),
      };

      setScannedProduct(foodFromApi);
    } catch (error) {
      setApiError('Unable to fetch barcode data.');
    } finally {
      setApiLoading(false);
    }
  }

  function handleBarcodeScanned({ data }) {
    if (scanned) return;

    setScanned(true);
    setLastBarcode(data);
    setScannerOpen(false);
    fetchProductByBarcode(data);
  }

  async function searchUsdaFoods() {
    console.log('USDA API KEY:', USDA_API_KEY);
    console.log('Searching for:', usdaSearch);

    if (!usdaSearch.trim()) {
      setUsdaError('Please enter a food.');
      return;
    }

    setUsdaLoading(true);
    setUsdaError('');
    setUsdaResults([]);

    try {
      const response = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(
          usdaSearch
        )}&pageSize=10&api_key=${USDA_API_KEY}`
      );

      if (!response.ok) {
        throw new Error('USDA search failed.');
      }

      const data = await response.json();

      const formattedResults = (data.foods || []).map((item) => {
        const nutrients = item.foodNutrients || [];

        const findNutrient = (name) => {
          const nutrient = nutrients.find((n) =>
            n.nutrientName?.toLowerCase().includes(name)
          );

          return Math.round(nutrient?.value || 0);
        };

        return {
          id: String(item.fdcId),
          name: item.description || 'Unnamed Food',
          brand: item.brandName || item.dataType || 'USDA FoodData Central',
          serving: '100 g',
          calories: findNutrient('energy'),
          protein: findNutrient('protein'),
          carbs: findNutrient('carbohydrate'),
          fat: findNutrient('total lipid'),
        };
      });

      setUsdaResults(formattedResults);
    } catch (error) {
      setUsdaError('Unable to search USDA foods.');
    } finally {
      setUsdaLoading(false);
    }
  }

  if (scannerOpen) {
    return (
      <SafeAreaView style={styles.scannerSafeArea}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.appTitle}>Personal Macro Tracker</Text>

        {lastBarcode ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Last Barcode Scanned</Text>
            <Text>{lastBarcode}</Text>
          </View>
        ) : null}

        {apiLoading ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Looking up product...</Text>
          </View>
        ) : null}

        {apiError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{apiError}</Text>
          </View>
        ) : null}

        {scannedProduct ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scanned Product</Text>
            <Text style={styles.foodName}>{scannedProduct.name}</Text>
            <Text style={styles.foodMeta}>{scannedProduct.serving}</Text>
            <Text style={styles.foodMeta}>
              {scannedProduct.calories} cal • P {scannedProduct.protein}g • C{' '}
              {scannedProduct.carbs}g • F {scannedProduct.fat}g
            </Text>

            <TouchableOpacity
              style={styles.fullButton}
              onPress={() => addFood(scannedProduct)}
            >
              <Text style={styles.fullButtonText}>Add to Food Log</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile</Text>

          <View style={styles.row}>
            <Input
              label="Age"
              value={profile.age}
              onChangeText={(v) => updateProfile('age', v)}
              keyboardType="numeric"
            />

            <Input
              label="Height"
              value={profile.heightIn}
              onChangeText={(v) => updateProfile('heightIn', v)}
              keyboardType="numeric"
            />

            <Input
              label="Weight"
              value={profile.weightLb}
              onChangeText={(v) => updateProfile('weightLb', v)}
              keyboardType="numeric"
            />
          </View>

          <Text style={styles.label}>Sex</Text>

          <ButtonGroup
            options={[
              { label: 'Male', value: 'male' },
              { label: 'Female', value: 'female' },
            ]}
            selected={profile.sex}
            onSelect={(value) => updateProfile('sex', value)}
          />

          <Text style={styles.label}>Activity</Text>

          <ButtonGroup
            options={[
              { label: 'Sedentary', value: 'sedentary' },
              { label: 'Light', value: 'light' },
              { label: 'Moderate', value: 'moderate' },
              { label: 'Active', value: 'active' },
              { label: 'Athlete', value: 'athlete' },
            ]}
            selected={profile.activity}
            onSelect={(value) => updateProfile('activity', value)}
          />

          <Text style={styles.label}>Goal</Text>

          <ButtonGroup
            options={[
              { label: 'Cut', value: 'cut' },
              { label: 'Maintain', value: 'maintain' },
              { label: 'Bulk', value: 'bulk' },
            ]}
            selected={profile.goal}
            onSelect={(value) => updateProfile('goal', value)}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily Targets</Text>
          <MacroGrid data={macroGoals} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Progress</Text>

          <ProgressLine
            label="Calories"
            current={totals.calories}
            target={macroGoals.calories}
            unit="cal"
          />

          <ProgressLine
            label="Protein"
            current={totals.protein}
            target={macroGoals.protein}
            unit="g"
          />

          <ProgressLine
            label="Carbs"
            current={totals.carbs}
            target={macroGoals.carbs}
            unit="g"
          />

          <ProgressLine
            label="Fat"
            current={totals.fat}
            target={macroGoals.fat}
            unit="g"
          />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Add Food</Text>

            <TouchableOpacity style={styles.scanButton} onPress={openScanner}>
              <Text style={styles.scanButtonText}>Scan Barcode</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionLabel}>Starter Foods</Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Search starter foods..."
            value={search}
            onChangeText={setSearch}
          />

          {filteredFoods.map((food) => (
            <TouchableOpacity
              key={food.id}
              style={styles.foodItem}
              onPress={() => addFood(food)}
            >
              <View>
                <Text style={styles.foodName}>{food.name}</Text>
                <Text style={styles.foodMeta}>{food.serving}</Text>
              </View>

              <Text style={styles.foodCalories}>{food.calories} cal</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.sectionLabel}>Search USDA Foods</Text>

          <View style={styles.usdaSearchRow}>
            <TextInput
              style={styles.usdaSearchInput}
              placeholder="Search chicken breast..."
              value={usdaSearch}
              onChangeText={setUsdaSearch}
            />

            <TouchableOpacity style={styles.usdaSearchButton} onPress={searchUsdaFoods}>
              <Text style={styles.usdaSearchButtonText}>Search</Text>
            </TouchableOpacity>
          </View>

          {usdaLoading ? <Text style={styles.loadingText}>Searching USDA...</Text> : null}

          {usdaError ? <Text style={styles.usdaErrorText}>{usdaError}</Text> : null}

          <FoodSearchResults results={usdaResults} onAddFood={addFood} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Food Log</Text>

          {foodLog.length === 0 ? (
            <Text style={styles.emptyText}>No foods logged yet.</Text>
          ) : (
            foodLog.map((food) => (
              <TouchableOpacity
                key={food.logId}
                style={styles.foodItem}
                onPress={() => removeFood(food.logId)}
              >
                <View>
                  <Text style={styles.foodName}>{food.name}</Text>
                  <Text style={styles.foodMeta}>
                    {food.calories} cal • P {food.protein}g • C {food.carbs}g • F{' '}
                    {food.fat}g
                  </Text>
                </View>

                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f6fb',
  },
  container: {
    padding: 18,
    paddingBottom: 40,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 18,
    color: '#172033',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
  },
  infoCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  infoTitle: {
    fontWeight: '900',
    color: '#172033',
    marginBottom: 4,
  },
  errorCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#991b1b',
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 12,
    color: '#172033',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    color: '#374151',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scanButton: {
    backgroundColor: '#172033',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  scanButtonText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  fullButton: {
    backgroundColor: '#172033',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  fullButtonText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  searchInput: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
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
  foodCalories: {
    fontWeight: '900',
    color: '#172033',
  },
  removeText: {
    color: '#991b1b',
    fontWeight: '900',
  },
  emptyText: {
    color: '#6b7280',
    fontStyle: 'italic',
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 18,
    marginBottom: 8,
    color: '#172033',
  },
  usdaSearchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  usdaSearchInput: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    fontSize: 16,
  },
  usdaSearchButton: {
    backgroundColor: '#172033',
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  usdaSearchButtonText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  loadingText: {
    color: '#6b7280',
    marginBottom: 8,
  },
  usdaErrorText: {
    color: '#991b1b',
    marginBottom: 8,
  },
  scannerSafeArea: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
});