import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useRouteStore, findStopByAddress } from '../store/useRouteStore';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Scanner'>;
};

const { width: SCREEN_W } = Dimensions.get('window');
const BOX_SIZE = SCREEN_W * 0.85;

const C = {
  emerald:     '#10B981',
  overlay:     'rgba(0, 0, 0, 0.65)',
  white:       '#FFFFFF',
  backBtn:     'rgba(255, 255, 255, 0.20)',
  captureRing: 'rgba(255, 255, 255, 0.30)',
};

export default function ScannerScreen({ navigation }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const addStop = useRouteStore(state => state.addStop);
  const updateStop = useRouteStore(state => state.updateStop);

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <StatusBar barStyle="dark-content" />
        <Ionicons name="camera-outline" size={64} color={C.emerald} style={{ marginBottom: 24 }} />
        <Text style={styles.permissionTitle}>Acceso a camara requerido</Text>
        <Text style={styles.permissionBody}>
          Necesitamos la camara para escanear guias de envio y extraer la direccion automaticamente.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Permitir acceso</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.permissionSkip} onPress={() => navigation.goBack()}>
          <Text style={styles.permissionSkipText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCapture = () => {
    setProcessing(true);
    setTimeout(() => { 
      setProcessing(false); 
      
      // Simular OCR obteniendo una dirección que ya existe
      const scannedAddress = 'Calle 166 #9-24';
      const scannedName = 'Juan Perez'; // Nombre simulado del paquete
      
      const existingStop = findStopByAddress(useRouteStore.getState().stops, scannedAddress);

      if (existingStop) {
        Alert.alert(
          'Dirección ya registrada',
          '¿Agregar este paquete a un nuevo cliente en esta parada?',
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => navigation.goBack() },
            { 
              text: 'Aceptar', 
              onPress: () => {
                const existingClient = existingStop.clients.find(c => c.name === scannedName);
                const clients = existingClient
                  ? existingStop.clients.map(c =>
                      c.id === existingClient.id ? { ...c, packages: c.packages + 1 } : c
                    )
                  : [
                      ...existingStop.clients,
                      {
                        id: `c${Date.now()}`,
                        name: scannedName,
                        phone: '',
                        packages: 1,
                        notes: ''
                      },
                    ];
                updateStop(existingStop.id, { clients });
                navigation.goBack();
              }
            }
          ]
        );
      } else {
        addStop({
          id: `s${Date.now()}`,
          address: scannedAddress,
          detail: '',
          lat: 4.6097,
          lng: -74.0817,
          status: 'pending',
          colorCode: '#3B82F6',
          clients: [
            {
              id: `c${Date.now()}`,
              name: scannedName,
              phone: '',
              packages: 1,
              notes: ''
            },
          ],
        });
        navigation.goBack();
      }
    }, 2000);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* CRITICAL RULE: CameraView without children */}
      <CameraView style={StyleSheet.absoluteFill} facing="back" />

      {/* Flex-based Overlay */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]} pointerEvents="none">
        <View style={styles.maskTop}>
          {/* Instruction text */}
          <View style={styles.instructionBlock}>
            <Text style={styles.instructionMain}>Encuadra TODA la etiqueta</Text>
            <Text style={styles.instructionSub}>Extraeremos direccion, nombre y telefono</Text>
          </View>
        </View>
        <View style={styles.maskCenterRow}>
          <View style={styles.maskSide} />
          <View style={styles.boundingBox}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>
          <View style={styles.maskSide} />
        </View>
        <View style={styles.maskBottom} />
      </View>

      {/* Back button top-left */}
      <SafeAreaView style={styles.backWrapper} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <Ionicons name="arrow-back" size={22} color={C.white} />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Capture button bottom centre */}
      <View style={styles.captureWrapper}>
        <TouchableOpacity
          style={styles.captureRing}
          onPress={handleCapture}
          disabled={processing}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Tomar foto"
        >
          {processing ? <ActivityIndicator color={C.emerald} size="large" /> : <View style={styles.captureCore} />}
        </TouchableOpacity>
        <Text style={styles.captureLabel}>{processing ? 'Procesando...' : 'Tomar foto'}</Text>
      </View>
    </View>
  );
}

const CORNER_SIZE = 28;
const CORNER_THICKNESS = 4;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 32 },
  permissionTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 12, textAlign: 'center' },
  permissionBody: { fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  permissionBtn: { backgroundColor: '#10B981', borderRadius: 12, height: 52, width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  permissionBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  permissionSkip: { padding: 12 },
  permissionSkipText: { color: '#64748B', fontSize: 15 },
  
  // Overlay Masks
  maskTop: { flex: 1, backgroundColor: C.overlay, justifyContent: 'flex-end', paddingBottom: 24 },
  maskCenterRow: { flexDirection: 'row', height: BOX_SIZE },
  maskSide: { flex: 1, backgroundColor: C.overlay },
  maskBottom: { flex: 1, backgroundColor: C.overlay },
  
  boundingBox: { width: '85%', height: '100%', backgroundColor: 'transparent' },
  
  corner: { position: 'absolute', width: CORNER_SIZE, height: CORNER_SIZE, borderColor: C.emerald, borderWidth: CORNER_THICKNESS },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 8 },
  
  instructionBlock: { alignItems: 'center', paddingHorizontal: 24 },
  instructionMain: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 6, textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  instructionSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  
  backWrapper: { position: 'absolute', top: 0, left: 0, zIndex: 40, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 8 : 8, paddingLeft: 16 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  
  captureWrapper: { position: 'absolute', bottom: 52, left: 0, right: 0, alignItems: 'center', zIndex: 40 },
  captureRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.30)', borderWidth: 3, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  captureCore: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF' },
  captureLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
});
