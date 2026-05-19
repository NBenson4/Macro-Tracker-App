// App.js
// Macro tracker MVP with profile-based macro calculation, food logging,
// and barcode scanning using Expo Camera.

import Input from './components/Input';
import ButtonGroup from './components/ButtonGroup';
import MacroGrid from './components/MacroGrid';
import ProgressLine from './components/ProgressLine';

import React, { useMemo, useState } from 'react';
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

  // Mifflin-St Jeor BMR formula
  const sexAdjustment = sex === 'female' ? -161 : 5;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + sexAdjustment;
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activity];
  const calories = Math.round(tdee + GOAL_ADJUSTMENTS[goal]);

  // Simple macro defaults for strength/body composition
  const protein = Math.round(weightLb * 1.0);
  const fat = Math.round((calories * 0.25) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);

  return { calories, protein, carbs, fat };
}

const starterFoods = [
  {
    id: '1',
    name: 'Chicken Breast, cooked',
    serving: '4 oz',
    calories: 185,
    protein: 35,
    carbs: 0,
    fat: 4,
  },
  {
    id: '2',
    name: 'White Rice, cooked',
    serving: '1 cup',
    calories: 205,
    protein: 4,
    carbs: 45,
    fat: 0,
  },
  {
    id: '3',
    name: 'Large Egg',
    serving: '1 egg',
    calories: 70,
    protein: 6,
    carbs: 1,
    fat: 5,
  },
];

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [lastBarcode, setLastBarcode] = useState('');
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [scannedProduct, setScannedProduct] = useState(null);

  const [profile, setProfile] = useState({
    sex: 'male',
    age: '22',
    heightIn: '74',
    weightLb: '220',
    activity: 'active',
    goal: 'maintain',
  });

  const [foodLog, setFoodLog] = useState([]);
  const [search, setSearch] = useState('');

  const macroGoals = useMemo(() => {
    const age = Number(profile.age);
    const heightIn = Number(profile.heightIn);
    const weightLb = Number(profile.weightLb);

    if (!age || !heightIn || !weightLb) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0 };
    }

    return calculateMacros({
      sex: profile.sex,
      age,
      heightIn,
      weightLb,
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
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function addFood(food) {
    setFoodLog((current) => [...current, { ...food, logId: Date.now().toString() }]);
  }

  function removeFood(logId) {
    setFoodLog((current) => current.filter((food) => food.logId !== logId));
  }

  async function openScanner() {
    if (!permission?.granted) {
      const response = await requestPermission();

      if (!response.granted) {
        Alert.alert('Camera Permission Needed', 'Please allow camera access to scan barcodes.');
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
      const fields = [
        'product_name',
        'brands',
        'serving_size',
        'nutriments',
        'image_front_small_url',
      ].join(',');

      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${fields}`
      );

      if (!response.ok) {
        throw new Error('Unable to connect to Open Food Facts.');
      }

      const data = await response.json();

      if (data.status !== 1 || !data.product) {
        setApiError('Product not found. Try another barcode or add the food manually.');
        return;
      }

      const product = data.product;
      const nutriments = product.nutriments || {};

      const foodFromApi = {
        id: barcode,
        name: product.product_name || product.brands || 'Unknown Product',
        brand: product.brands || '',
        serving: product.serving_size || '100 g',
        calories: Math.round(
          nutriments['energy-kcal_serving'] ?? nutriments['energy-kcal_100g'] ?? 0
        ),
        protein: Math.round(
          nutriments.proteins_serving ?? nutriments.proteins_100g ?? 0
        ),
        carbs: Math.round(
          nutriments.carbohydrates_serving ?? nutriments.carbohydrates_100g ?? 0
        ),
        fat: Math.round(
          nutriments.fat_serving ?? nutriments.fat_100g ?? 0
        ),
      };

      setScannedProduct(foodFromApi);
    } catch (error) {
      setApiError(error.message || 'Something went wrong while looking up this product.');
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

  if (scannerOpen) {
    return (
      <SafeAreaView style={styles.scannerSafeArea}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
        >
          <View style={styles.scannerOverlay}>
            <Text style={styles.scannerTitle}>Scan a Food Barcode</Text>
            <Text style={styles.scannerHelp}>Center the barcode inside the box.</Text>

            <View style={styles.scanFrame} />

            <TouchableOpacity style={styles.closeScannerButton} onPress={() => setScannerOpen(false)}>
              <Text style={styles.closeScannerText}>Cancel Scan</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.appTitle}>Personal Macro Tracker</Text>
        <Text style={styles.subtitle}>Track calories, protein, carbs, and fat.</Text>

        {lastBarcode ? (
          <View style={styles.barcodeNotice}>
            <Text style={styles.barcodeNoticeTitle}>Last Barcode Scanned</Text>
            <Text style={styles.barcodeNoticeText}>{lastBarcode}</Text>
          </View>
        ) : null}

        {apiLoading ? (
          <View style={styles.apiCard}>
            <Text style={styles.apiTitle}>Looking up nutrition data...</Text>
            <Text style={styles.apiText}>Searching Open Food Facts for the scanned barcode.</Text>
          </View>
        ) : null}

        {apiError ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Product Lookup Issue</Text>
            <Text style={styles.errorText}>{apiError}</Text>
          </View>
        ) : null}

        {scannedProduct ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Scanned Product</Text>
            <Text style={styles.scannedProductName}>{scannedProduct.name}</Text>
            {scannedProduct.brand ? <Text style={styles.foodMeta}>{scannedProduct.brand}</Text> : null}
            <Text style={styles.foodMeta}>Serving: {scannedProduct.serving}</Text>
            <Text style={styles.foodMeta}>
              {scannedProduct.calories} cal • P {scannedProduct.protein}g • C {scannedProduct.carbs}g • F {scannedProduct.fat}g
            </Text>
            <TouchableOpacity style={styles.addScannedButton} onPress={() => addFood(scannedProduct)}>
              <Text style={styles.addScannedButtonText}>Add to Food Log</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Profile</Text>

          <View style={styles.row}>
            <Input label="Age" value={profile.age} onChangeText={(v) => updateProfile('age', v)} keyboardType="numeric" />
            <Input label="Height (in)" value={profile.heightIn} onChangeText={(v) => updateProfile('heightIn', v)} keyboardType="numeric" />
            <Input label="Weight (lb)" value={profile.weightLb} onChangeText={(v) => updateProfile('weightLb', v)} keyboardType="numeric" />
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
          <Text style={styles.cardTitle}>Today’s Progress</Text>
          <ProgressLine label="Calories" current={totals.calories} target={macroGoals.calories} unit="cal" />
          <ProgressLine label="Protein" current={totals.protein} target={macroGoals.protein} unit="g" />
          <ProgressLine label="Carbs" current={totals.carbs} target={macroGoals.carbs} unit="g" />
          <ProgressLine label="Fat" current={totals.fat} target={macroGoals.fat} unit="g" />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Add Food</Text>
            <TouchableOpacity style={styles.scanButton} onPress={openScanner}>
              <Text style={styles.scanButtonText}>Scan Barcode</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search starter foods..."
            value={search}
            onChangeText={setSearch}
          />

          {filteredFoods.map((food) => (
            <TouchableOpacity key={food.id} style={styles.foodItem} onPress={() => addFood(food)}>
              <View>
                <Text style={styles.foodName}>{food.name}</Text>
                <Text style={styles.foodMeta}>{food.serving}</Text>
              </View>
              <Text style={styles.foodCalories}>{food.calories} cal</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Food Log</Text>
          {foodLog.length === 0 ? (
            <Text style={styles.emptyText}>No foods logged yet.</Text>
          ) : (
            foodLog.map((food) => (
              <TouchableOpacity key={food.logId} style={styles.logItem} onPress={() => removeFood(food.logId)}>
                <View>
                  <Text style={styles.foodName}>{food.name}</Text>
                  <Text style={styles.foodMeta}>
                    P {food.protein}g • C {food.carbs}g • F {food.fat}g
                  </Text>
                </View>
                <Text style={styles.foodCalories}>{food.calories} cal</Text>
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
    paddingBottom: 36,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#172033',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 18,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#172033',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    fontSize: 16,
  },
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
  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
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
  scanButton: {
    backgroundColor: '#172033',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  scanButtonText: {
    color: '#ffffff',
    fontWeight: '800',
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
    borderBottomColor: '#f3f4f6',
    borderBottomWidth: 1,
  },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomColor: '#f3f4f6',
    borderBottomWidth: 1,
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
  emptyText: {
    color: '#6b7280',
    fontStyle: 'italic',
  },
  barcodeNotice: {
    backgroundColor: '#e8eefc',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  barcodeNoticeTitle: {
    fontWeight: '900',
    color: '#172033',
    marginBottom: 4,
  },
  barcodeNoticeText: {
    color: '#374151',
    fontWeight: '700',
  },
  apiCard: {
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  apiTitle: {
    fontWeight: '900',
    color: '#172033',
    marginBottom: 4,
  },
  apiText: {
    color: '#4b5563',
  },
  errorCard: {
    backgroundColor: '#fee2e2',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  errorTitle: {
    fontWeight: '900',
    color: '#7f1d1d',
    marginBottom: 4,
  },
  errorText: {
    color: '#991b1b',
  },
  scannedProductName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#172033',
    marginBottom: 4,
  },
  addScannedButton: {
    backgroundColor: '#172033',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  addScannedButtonText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  scannerSafeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  camera: {
    flex: 1,
  },
  scannerOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 24,
  },
  scannerTitle: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '900',
    marginBottom: 8,
  },
  scannerHelp: {
    color: '#ffffff',
    fontSize: 15,
    marginBottom: 28,
  },
  scanFrame: {
    width: 280,
    height: 180,
    borderWidth: 4,
    borderColor: '#ffffff',
    borderRadius: 20,
    marginBottom: 32,
  },
  closeScannerButton: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  closeScannerText: {
    color: '#172033',
    fontWeight: '900',
  },
});