/**
 * src/screens/RouteSetupScreen.tsx
 * Pantalla principal de EnRuta.
 *
 * Flujo del conductor:
 * 1. Define el punto de inicio (GPS o direccion manual)
 * 2. Escanea guias de envio (boton gigante -> ML Kit OCR)
 * 3. Revisa el resumen de paradas detectadas
 * 4. Presiona "Optimizar y salir" para calcular la ruta con OR-Tools
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { Colors, Typography, Spacing, Radius, TouchTarget, Shadows } from '../theme';
import StartPointPicker, { StartPoint } from '../components/StartPointPicker';
import { optimizeRoute, OptimizeResult } from '../services/api';

// â”€â”€â”€ PLACEHOLDER: ID de ruta activo (en produccion viene de AuthContext / navegacion)
const ACTIVE_ROUTE_ID = 'xxxxxxxx-0000-0000-0000-xxxxxxxxxxxx';

export default function RouteSetupScreen() {
  const [startPoint,  setStartPoint]  = useState<StartPoint | null>(null);
  const [scannedCount, setScannedCount] = useState(0);   // contador de guias escaneadas
  const [optimizing,  setOptimizing]  = useState(false);
  const [result,      setResult]      = useState<OptimizeResult | null>(null);

  // â”€â”€â”€ Escanear guia â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleScanGuide = useCallback(() => {
    /**
     * TODO: Abrir la camara con expo-camera / Google ML Kit Text Recognition
     * Por ahora incrementa el contador como placeholder visual.
     *
     * Implementacion futura:
     *   const ocrResult = await scanGuide();  // llama a /api/v1/ocr/process-guide
     *   addStopToRoute(ocrResult);
     */
    Alert.alert(
      'Escanear Guia',
      'Proximamente: apunta la camara al codigo de barras o al texto de la guia.',
      [
        { text: 'Simular escaneo', onPress: () => setScannedCount(n => n + 1) },
        { text: 'Cancelar', style: 'cancel' },
      ],
    );
  }, []);

  // â”€â”€â”€ Optimizar ruta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleOptimize = useCallback(async () => {
    if (!startPoint) {
      Alert.alert('Falta el punto de inicio', 'Selecciona tu ubicacion actual o escribe la direccion de la bodega antes de optimizar.');
      return;
    }
    if (scannedCount === 0) {
      Alert.alert('Sin paradas', 'Escanea al menos una guia de envio antes de optimizar la ruta.');
      return;
    }

    setOptimizing(true);
    try {
      const origin = startPoint.type === 'gps'
        ? { lat: startPoint.lat, lon: startPoint.lon }
        : { address: startPoint.address };

      const optimizeResult = await optimizeRoute(ACTIVE_ROUTE_ID, origin);
      setResult(optimizeResult);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      Alert.alert('Error al optimizar', msg);
    } finally {
      setOptimizing(false);
    }
  }, [startPoint, scannedCount]);

  // â”€â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>ðŸšš EnRuta</Text>
        <Text style={styles.headerSubtitle}>Prepara tu ruta de entrega</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >

        {/* â”€â”€ SECCION: Punto de inicio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <View style={styles.section}>
          <StartPointPicker
            onStartPointSelected={setStartPoint}
            onClear={() => setStartPoint(null)}
          />
        </View>

        {/* â”€â”€ SECCION: Escanear guias â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Guias de envio</Text>

          {/* Boton GIGANTE de escaneo â€“ area tactil maxima para uso con guantes */}
          <TouchableOpacity
            style={styles.scanButton}
            onPress={handleScanGuide}
            accessibilityLabel="Escanear guia de envio"
            accessibilityRole="button"
            accessibilityHint="Abre la camara para leer el codigo o texto de la guia"
          >
            <Text style={styles.scanIcon}>ðŸ“·</Text>
            <Text style={styles.scanButtonText}>Escanear Guia</Text>
            <Text style={styles.scanButtonSub}>ML Kit Â· OCR automatico</Text>
          </TouchableOpacity>

          {/* Contador de guias escaneadas */}
          {scannedCount > 0 && (
            <View style={styles.scanCounter}>
              <Text style={styles.scanCounterText}>
                {scannedCount} {scannedCount === 1 ? 'guia escaneada' : 'guias escaneadas'}
              </Text>
              <TouchableOpacity onPress={() => setScannedCount(0)}>
                <Text style={styles.clearScansText}>Limpiar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* â”€â”€ RESULTADO DE OPTIMIZACION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {result && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>âœ… Ruta Optimizada</Text>
            <Text style={styles.resultStat}>
              ðŸ“ {result.estimated_distance_km.toFixed(1)} km
            </Text>
            <Text style={styles.resultStat}>
              â± ~{result.estimated_duration_min} minutos
            </Text>
            <Text style={styles.resultStat}>
              ðŸ“¦ {result.total_stops} paradas
            </Text>
            <Text style={styles.resultMessage}>{result.message}</Text>
          </View>
        )}

        {/* â”€â”€ BOTON: Optimizar y salir â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[
              styles.optimizeButton,
              (!startPoint || scannedCount === 0 || optimizing) && styles.optimizeButtonDisabled,
            ]}
            onPress={handleOptimize}
            disabled={!startPoint || scannedCount === 0 || optimizing}
            accessibilityLabel="Optimizar ruta y salir a entregar"
            accessibilityRole="button"
          >
            {optimizing ? (
              <>
                <ActivityIndicator color={Colors.textOnDark} size="large" />
                <Text style={styles.optimizeButtonText}>Calculando ruta...</Text>
              </>
            ) : (
              <>
                <Text style={styles.optimizeButtonIcon}>ðŸ—ºï¸</Text>
                <Text style={styles.optimizeButtonText}>
                  {result ? 'Recalcular Ruta' : 'Optimizar y Salir'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Hint de accesibilidad cuando faltan datos */}
          {(!startPoint || scannedCount === 0) && !optimizing && (
            <Text style={styles.optimizeHint}>
              {!startPoint
                ? 'â¬† Define el punto de inicio primero'
                : 'â¬† Escanea al menos una guia'}
            </Text>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// â”€â”€â”€ Estilos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.primary,
  },

  // Header
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical:   Spacing.md,
    paddingTop:        Spacing.lg,
  },
  headerTitle: {
    fontSize:   Typography.size.xxl,
    fontWeight: Typography.weight.extrabold,
    color:      Colors.textOnDark,
  },
  headerSubtitle: {
    fontSize:   Typography.size.md,
    color:      Colors.primaryLight,
    marginTop:  Spacing.xs,
  },

  // Contenido scrollable
  scrollContent: {
    flexGrow: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius:  Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    gap:     Spacing.lg,
  },

  // Secciones
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize:   Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color:      Colors.textPrimary,
    marginBottom: Spacing.xs,
  },

  // â”€â”€ Boton de escaneo GIGANTE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  scanButton: {
    backgroundColor:  Colors.accent,
    borderRadius:     Radius.xl,
    minHeight:        TouchTarget.xl,
    alignItems:       'center',
    justifyContent:   'center',
    gap:              Spacing.xs,
    paddingVertical:  Spacing.lg,
    ...Shadows.lg,
  },
  scanIcon: {
    fontSize: 48,
  },
  scanButtonText: {
    fontSize:   Typography.size.xxl,
    fontWeight: Typography.weight.extrabold,
    color:      Colors.textOnDark,
    letterSpacing: 0.5,
  },
  scanButtonSub: {
    fontSize:   Typography.size.sm,
    color:      Colors.textOnDark,
    opacity:    0.85,
  },

  // Contador de guias
  scanCounter: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    backgroundColor: Colors.surface,
    borderRadius:    Radius.md,
    padding:         Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
    ...Shadows.sm,
  },
  scanCounterText: {
    fontSize:   Typography.size.md,
    fontWeight: Typography.weight.semibold,
    color:      Colors.success,
  },
  clearScansText: {
    fontSize:   Typography.size.sm,
    color:      Colors.error,
    fontWeight: Typography.weight.medium,
  },

  // â”€â”€ Resultado de optimizacion â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  resultCard: {
    backgroundColor: Colors.surface,
    borderRadius:    Radius.lg,
    padding:         Spacing.lg,
    gap:             Spacing.sm,
    borderLeftWidth: 5,
    borderLeftColor: Colors.success,
    ...Shadows.md,
  },
  resultTitle: {
    fontSize:   Typography.size.lg,
    fontWeight: Typography.weight.bold,
    color:      Colors.success,
  },
  resultStat: {
    fontSize:   Typography.size.md,
    color:      Colors.textPrimary,
    fontWeight: Typography.weight.medium,
  },
  resultMessage: {
    fontSize:   Typography.size.sm,
    color:      Colors.textSecondary,
    marginTop:  Spacing.xs,
  },

  // â”€â”€ Boton optimizar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  actionSection: {
    gap:           Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  optimizeButton: {
    backgroundColor:  Colors.primary,
    borderRadius:     Radius.xl,
    minHeight:        TouchTarget.xl,
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'center',
    gap:              Spacing.md,
    paddingHorizontal: Spacing.xl,
    ...Shadows.lg,
  },
  optimizeButtonDisabled: {
    backgroundColor: Colors.textMuted,
    ...Shadows.sm,
  },
  optimizeButtonIcon: {
    fontSize: 32,
  },
  optimizeButtonText: {
    fontSize:   Typography.size.xl,
    fontWeight: Typography.weight.extrabold,
    color:      Colors.textOnDark,
    letterSpacing: 0.5,
  },
  optimizeHint: {
    textAlign:  'center',
    fontSize:   Typography.size.sm,
    color:      Colors.textMuted,
    fontStyle:  'italic',
  },
});