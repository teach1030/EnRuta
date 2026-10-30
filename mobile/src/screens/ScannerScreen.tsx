import React, { useRef, useState } from 'react';
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
import {
  useRouteStore,
  findStopByAddress,
  isUuid,
  mapApiStopToStore,
} from '../store/useRouteStore';
import { api, getAuthToken } from '../services/api';

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
  const cameraRef = useRef<CameraView>(null);

  const addStop = useRouteStore(state => state.addStop);
  const updateStop = useRouteStore(state => state.updateStop);
  const ensureActiveRoute = useRouteStore(state => state.ensureActiveRoute);

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

  const handleCapture = async () => {
    if (!cameraRef.current || processing) return;

    setProcessing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) {
        throw new Error('No se pudo capturar la imagen de la camara.');
      }

      const ocrResult = await api.ocr.processGuide(photo.uri);
      const scannedAddress = (ocrResult.normalized_address || ocrResult.raw_address || '').trim();
      const scannedName = (ocrResult.recipient_name || 'Cliente').trim();
      const scannedPhone = (ocrResult.recipient_phone || '').trim();
      const scannedNotes = (ocrResult.complement || '').trim();
      const scannedDetail = [ocrResult.complement, ocrResult.locality].filter(Boolean).join(', ');
      const lat = ocrResult.lat ?? 4.6097;
      const lng = ocrResult.lng ?? -74.0817;

      if (!scannedAddress) {
        Alert.alert(
          'Direccion no detectada',
          'No logramos identificar la direccion en la guia. Intenta acercar mas la camara con buena iluminacion.'
        );
        return;
      }

      const existingStop = findStopByAddress(useRouteStore.getState().stops, scannedAddress);

      if (existingStop) {
        Alert.alert(
          'Dirección ya registrada',
          '¿Agregar este paquete a un nuevo cliente en esta parada?',
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => navigation.goBack() },
            {
              text: 'Aceptar',
              onPress: async () => {
                const existingClient = existingStop.clients.find(
                  c => c.name.trim().toLowerCase() === scannedName.toLowerCase()
                );
                const clients = existingClient
                  ? existingStop.clients.map(c =>
                      c.id === existingClient.id ? { ...c, packages: c.packages + 1 } : c
                    )
                  : [
                      ...existingStop.clients,
                      {
                        id: `c${Date.now()}`,
                        name: scannedName,
                        phone: scannedPhone,
                        packages: 1,
                        notes: scannedNotes,
                      },
                    ];

                updateStop(existingStop.id, { clients });

                if (getAuthToken() && isUuid(existingStop.id)) {
                  try {
                    const updated = await api.stops.update(existingStop.id, {
                      clients: clients.map(c => ({
                        id: isUuid(c.id) ? c.id : undefined,
                        name: c.name || 'Cliente',
                        phone: c.phone || undefined,
                        packages_count: c.packages || 1,
                        notes: c.notes || undefined,
                      })),
                    });
                    updateStop(existingStop.id, mapApiStopToStore(updated, existingStop.detail));
                  } catch {}
                }

                navigation.goBack();
              },
            },
          ]
        );
      } else {
        let createdOnBackend = false;
        if (getAuthToken()) {
          try {
            const activeRouteId = await ensureActiveRoute();
            if (activeRouteId) {
              const createdStop = await api.stops.create({
                route_id: activeRouteId,
                address: scannedAddress,
                lat: ocrResult.lat ?? undefined,
                lng: ocrResult.lng ?? undefined,
                color_code: '#3B82F6',
                clients: [
                  {
                    name: scannedName,
                    phone: scannedPhone || undefined,
                    packages_count: 1,
                    notes: scannedNotes || undefined,
                  },
                ],
              });
              addStop(mapApiStopToStore(createdStop, scannedDetail));
              createdOnBackend = true;
            }
          } catch {}
        }

        if (!createdOnBackend) {
          addStop({
            id: `s${Date.now()}`,
            address: scannedAddress,
            detail: scannedDetail,
            lat,
            lng,
            status: 'pending',
            colorCode: '#3B82F6',
            isPinned: false,
            clients: [
              {
                id: `c${Date.now()}`,
                name: scannedName,
                phone: scannedPhone,
                packages: 1,
                notes: scannedNotes,
              },
            ],
          });
        }

        navigation.goBack();
      }
    } catch (err: any) {
      Alert.alert(
        'Error al escanear guia',
        err?.message || 'No fue posible procesar la imagen de la guia.'
      );
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* CRITICAL RULE: CameraView without children */}
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* Flex-based Overlay */}
      <View style={[StyleSheet.absoluteFill, { zIndex: 10 }]} pointerEvents="none">
        <View style={styles.maskTop}>
          {/* Instruction text OUTSIDE the bounding box */}
          <View style={styles.instructionBlock}>
            <View style={styles.guideBadge}>
              <Ionicons name="scan-outline" size={18} color="#10B981" style={{ marginRight: 6 }} />
              <Text style={styles.guideBadgeText}>Apunta solo a los datos del destinatario</Text>
            </View>
            <Text style={styles.instructionSub}>
              Encuadra nombre, dirección y teléfono dentro del recuadro
            </Text>
          </View>
        </View>
        <View style={styles.maskCenterRow}>
          <View style={styles.maskSide} />
          {/* Centered bounding box with dashed borders - 100% unobstructed inside */}
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
  
  boundingBox: {
    width: '88%',
    height: '100%',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#10B981',
    borderRadius: 16,
    borderStyle: 'dashed',
    position: 'relative',
  },
  guideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6, 95, 70, 0.90)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#10B981',
    marginBottom: 8,
  },
  guideBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  
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
