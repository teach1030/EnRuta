/**
 * src/components/StartPointPicker.tsx
 * Selector del punto de inicio de la ruta.
 * Ofrece: (1) GPS via expo-location  (2) Direccion manual
 */
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, Radius, TouchTarget, Shadows } from '../theme';

export type StartPoint =
  | { type: 'gps'; lat: number; lon: number; label: string }
  | { type: 'address'; address: string };

interface Props {
  onStartPointSelected: (point: StartPoint) => void;
  onClear?: () => void;
}

export default function StartPointPicker({ onStartPointSelected, onClear }: Props) {
  const [addressText, setAddressText] = useState('');
  const [locating, setLocating] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<StartPoint | null>(null);

  const select = (point: StartPoint) => {
    setSelectedPoint(point);
    onStartPointSelected(point);
  };

  // ─── GPS ────────────────────────────────────────────────────────────────────
  const handleUseGPS = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso denegado', 'EnRuta necesita acceso a tu ubicacion para calcular la ruta.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      select({
        type: 'gps',
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        label: `${loc.coords.latitude.toFixed(5)}, ${loc.coords.longitude.toFixed(5)}`,
      });
      setAddressText('');
    } catch (error) {
      Alert.alert('Error de GPS', 'No se pudo obtener la ubicacion del dispositivo. Intenta de nuevo.');
    } finally {
      setLocating(false);
    }
  };

  // ─── Direccion manual ───────────────────────────────────────────────────────
  const handleConfirmAddress = () => {
    const trimmed = addressText.trim();
    if (trimmed.length < 5) {
      Alert.alert('Direccion incompleta', 'Escribe al menos la calle y el numero.');
      return;
    }
    select({ type: 'address', address: trimmed });
  };

  const handleClear = () => {
    setSelectedPoint(null);
    setAddressText('');
    onClear?.();
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  if (selectedPoint) {
    return (
      <View style={styles.selectedCard}>
        <View style={styles.selectedInfo}>
          <Ionicons
            name={selectedPoint.type === 'gps' ? 'navigate-circle' : 'location'}
            size={24}
            color={Colors.primary}
          />
          <Text style={styles.selectedText} numberOfLines={2}>
            {selectedPoint.type === 'gps' ? `GPS: ${selectedPoint.label}` : selectedPoint.address}
          </Text>
        </View>
        <TouchableOpacity onPress={handleClear} style={styles.clearBtn} accessibilityLabel="Cambiar punto de inicio">
          <Text style={styles.clearBtnText}>Cambiar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Punto de inicio</Text>

      <TouchableOpacity
        style={styles.gpsButton}
        onPress={handleUseGPS}
        disabled={locating}
        accessibilityLabel="Usar mi ubicacion actual"
        accessibilityRole="button"
      >
        {locating ? (
          <ActivityIndicator color={Colors.textOnDark} size="small" />
        ) : (
          <Ionicons name="navigate-outline" size={20} color={Colors.textOnDark} style={{ marginRight: 6 }} />
        )}
        <Text style={styles.gpsButtonText}>
          {locating ? 'Obteniendo ubicacion...' : 'Usar mi ubicacion actual'}
        </Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>o escribe la direccion</Text>
        <View style={styles.dividerLine} />
      </View>

      <TextInput
        style={styles.addressInput}
        value={addressText}
        onChangeText={setAddressText}
        placeholder="Ej: Calle 166 # 9-24 Usaquen"
        placeholderTextColor={Colors.textMuted}
        returnKeyType="done"
        onSubmitEditing={handleConfirmAddress}
        accessibilityLabel="Campo de direccion de inicio"
      />

      {addressText.length >= 5 && (
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirmAddress} accessibilityRole="button">
          <Text style={styles.confirmBtnText}>Confirmar direccion</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { gap: Spacing.sm },
  label:           { fontSize: Typography.size.md, fontWeight: Typography.weight.semibold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  gpsButton:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.primary, borderRadius: Radius.lg, minHeight: TouchTarget.lg, paddingHorizontal: Spacing.lg, ...Shadows.md },
  gpsButtonText:   { fontSize: Typography.size.lg, fontWeight: Typography.weight.bold, color: Colors.textOnDark },
  divider:         { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.sm },
  dividerLine:     { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText:     { fontSize: Typography.size.sm, color: Colors.textMuted },
  addressInput:    { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: Typography.size.md, color: Colors.textPrimary, minHeight: TouchTarget.md, backgroundColor: Colors.surface },
  confirmBtn:      { alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: Radius.md, minHeight: TouchTarget.md, paddingHorizontal: Spacing.lg },
  confirmBtnText:  { fontSize: Typography.size.md, fontWeight: Typography.weight.bold, color: Colors.textOnDark },
  selectedCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceAlt, borderRadius: Radius.md, borderWidth: 2, borderColor: Colors.primary, padding: Spacing.md, gap: Spacing.sm },
  selectedInfo:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  selectedText:    { flex: 1, fontSize: Typography.size.md, fontWeight: Typography.weight.medium, color: Colors.textPrimary },
  clearBtn:        { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.sm, borderWidth: 1.5, borderColor: Colors.primary },
  clearBtnText:    { fontSize: Typography.size.sm, fontWeight: Typography.weight.semibold, color: Colors.primary },
});
