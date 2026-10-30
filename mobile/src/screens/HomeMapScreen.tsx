import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableHighlight,
  Dimensions,
  Platform,
  StatusBar,
  Alert,
  Animated,
  PanResponder,
  Linking,
  ActivityIndicator,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import * as Location from 'expo-location';
import {
  useRouteStore,
  findStopByAddress,
  isUuid,
  mapApiStopToStore,
} from '../store/useRouteStore';
import type { Stop } from '../store/useRouteStore';
import { useAuthStore } from '../store/useAuthStore';
import { api, getAuthToken, initAuthToken } from '../services/api';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { Swipeable } from 'react-native-gesture-handler';
import SideMenu from '../components/SideMenu';

// ─── Constants ────────────────────────────────────────────────────────────────

const BOGOTA_REGION = {
  latitude: 4.6097,
  longitude: -74.0817,
  latitudeDelta: 0.18,
  longitudeDelta: 0.12,
};

const PALETTE = {
  forestGreen: '#065F46',   // CTA button
  emerald: '#10B981',       // accents, OCR icon
  lightGray: '#F1F5F9',     // search bar bg
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  white: '#FFFFFF',
  border: '#E2E8F0',
};

// ─── Types (re-exported from the global store for backwards compatibility) ──

export type { Client, Stop } from '../store/useRouteStore';

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Circular floating button with white background */
const FloatButton: React.FC<{
  onPress: () => void;
  children: React.ReactNode;
  style?: object;
}> = ({ onPress, children, style }) => (
  <TouchableOpacity
    style={[styles.floatBtn, style]}
    onPress={onPress}
    activeOpacity={0.8}
    accessibilityRole="button"
  >
    {children}
  </TouchableOpacity>
);

const LeftSwipeActions = () => (
  <View style={[styles.swipeAction, { backgroundColor: '#10B981' }]}>
    <Ionicons name="checkmark-circle-outline" size={24} color="#FFF" />
    <Text style={styles.swipeText}>Entregado</Text>
  </View>
);

const RightSwipeActions = () => (
  <View style={[styles.swipeAction, { backgroundColor: '#EF4444' }]}>
    <Ionicons name="close-circle-outline" size={24} color="#FFF" />
    <Text style={styles.swipeText}>Fallido</Text>
  </View>
);

const RevertSwipeActions = () => (
  <View style={[styles.swipeAction, { backgroundColor: '#64748B' }]}>
    <Ionicons name="arrow-undo-outline" size={24} color="#FFF" />
    <Text style={styles.swipeText}>Revertir</Text>
  </View>
);

/** Single row in the stop list */
const StopRow: React.FC<{
  stop: Stop;
  index: number;
  drag: () => void;
  isActive: boolean;
  onStatusChange: (id: string, status: Stop['status']) => void;
  onStopPress: (id: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  needsReoptimization?: boolean;
}> = ({ stop, index, drag, isActive, onStatusChange, onStopPress, onTogglePin, needsReoptimization }) => {
  const swipeableRef = useRef<Swipeable>(null);
  const isCompletedOrFailed = stop.status === 'delivered' || stop.status === 'failed';

  return (
    <ScaleDecorator>
      <Swipeable
        ref={swipeableRef}
        renderLeftActions={isCompletedOrFailed ? RevertSwipeActions : LeftSwipeActions}
        renderRightActions={isCompletedOrFailed ? RevertSwipeActions : RightSwipeActions}
        onSwipeableOpen={(direction) => {
          if (isCompletedOrFailed) {
            onStatusChange(stop.id, 'pending');
          } else if (direction === 'left') {
            onStatusChange(stop.id, 'delivered');
          } else if (direction === 'right') {
            onStatusChange(stop.id, 'failed');
          }
          swipeableRef.current?.close();
        }}
      >
        <TouchableHighlight
          onPress={() => onStopPress(stop.id)}
          onLongPress={drag}
          delayLongPress={180}
          disabled={isActive}
          underlayColor="#F1F5F9"
        >
          <View style={[styles.stopRow, isActive && styles.stopRowActive]}>
            {/* Index badge */}
            <View style={styles.stopIndex}>
              <Text
                style={[
                  styles.stopIndexText,
                  needsReoptimization && !stop.isPinned && styles.stopIndexTextUnoptimized,
                ]}
              >
                {needsReoptimization && !stop.isPinned
                  ? '-'
                  : String(index + 1).padStart(2, '0')}
              </Text>
            </View>
            {/* Address block */}
            <View style={styles.stopInfo}>
              <View style={styles.stopAddressRow}>
                <Text style={styles.stopAddress} numberOfLines={1}>
                  {stop.address}
                </Text>
                {stop.isPinned && (
                  <TouchableOpacity
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      onTogglePin(stop.id, false);
                    }}
                    style={styles.pinnedBadge}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel="Desbloquear parada"
                  >
                    <Ionicons name="lock-closed" size={13} color={PALETTE.forestGreen} />
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.stopDetail} numberOfLines={1}>
                {stop.detail}
              </Text>
            </View>
            {/* Status indicator */}
            {stop.status === 'pending' && (
              <View style={[styles.stopDot, { backgroundColor: stop.colorCode }]} />
            )}
            {stop.status === 'delivered' && (
              <Ionicons name="checkmark-circle" size={20} color="#10B981" />
            )}
            {stop.status === 'failed' && (
              <Ionicons name="close-circle" size={20} color="#EF4444" />
            )}
          </View>
        </TouchableHighlight>
      </Swipeable>
    </ScaleDecorator>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

const { height: SCREEN_H } = Dimensions.get('window');

/**
 * Snap points for the collapsible Bottom Sheet:
 * - 0: Collapsed (~12% of screen height) so the user can view the map freely
 * - 1: Default mid height (~48% of screen height)
 * - 2: Expanded height (~78% of screen height)
 */
const SNAP_POINTS = [
  Math.round(SCREEN_H * 0.12),
  Math.round(SCREEN_H * 0.54),
  Math.round(SCREEN_H * 0.80),
];

export default function HomeMapScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'HomeMap'>>();
  const route = useRoute<RouteProp<RootStackParamList, 'HomeMap'>>();

  const mapRef = useRef<MapView>(null);
  const currentRegionRef = useRef(BOGOTA_REGION);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showsTraffic, setShowsTraffic] = useState(false);
  const [mapType, setMapType] = useState<'standard' | 'satellite'>('standard');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showOptConfig, setShowOptConfig] = useState(false);
  const [startType, setStartType] = useState<'current' | 'address'>('current');
  const [startAddrInput, setStartAddrInput] = useState('');
  const [endType, setEndType] = useState<'last_stop' | 'return_start' | 'address'>('last_stop');
  const [endAddrInput, setEndAddrInput] = useState('');

  // ── Collapsible Bottom Sheet state & gestures ─────────────────────────────
  const [snapIndex, setSnapIndex] = useState(1);
  const snapIndexRef = useRef(1);
  const sheetHeight = useRef(new Animated.Value(SNAP_POINTS[1])).current;
  const startHeightRef = useRef(SNAP_POINTS[1]);

  const animateToSnap = (index: number) => {
    const clamped = Math.max(0, Math.min(SNAP_POINTS.length - 1, index));
    snapIndexRef.current = clamped;
    setSnapIndex(clamped);
    Animated.spring(sheetHeight, {
      toValue: SNAP_POINTS[clamped],
      useNativeDriver: false,
      bounciness: 3,
      speed: 18,
    }).start();
  };

  const toggleSheetCollapse = () => {
    animateToSnap(snapIndexRef.current === 0 ? 1 : 0);
  };

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 6,
      onPanResponderGrant: () => {
        sheetHeight.stopAnimation((value) => {
          startHeightRef.current = value;
        });
      },
      onPanResponderMove: (_, gestureState) => {
        const nextHeight = Math.max(
          SNAP_POINTS[0],
          Math.min(SNAP_POINTS[2], startHeightRef.current - gestureState.dy)
        );
        sheetHeight.setValue(nextHeight);
      },
      onPanResponderRelease: (_, gestureState) => {
        const projected = startHeightRef.current - gestureState.dy - gestureState.vy * 80;
        let closestIdx = 0;
        let minDistance = Math.abs(projected - SNAP_POINTS[0]);
        for (let i = 1; i < SNAP_POINTS.length; i++) {
          const dist = Math.abs(projected - SNAP_POINTS[i]);
          if (dist < minDistance) {
            minDistance = dist;
            closestIdx = i;
          }
        }
        animateToSnap(closestIdx);
      },
    })
  ).current;

  // ── Global route state (Zustand) ──────────────────────────────────────────
  const stops = useRouteStore(state => state.stops);
  const isOptimized = useRouteStore(state => state.isOptimized);
  const needsReoptimization = useRouteStore(state => state.needsReoptimization);
  const updateStop = useRouteStore(state => state.updateStop);
  const updateStopStatus = useRouteStore(state => state.updateStopStatus);
  const reorderStops = useRouteStore(state => state.reorderStops);
  const setStops = useRouteStore(state => state.setStops);
  const optimizeRoute = useRouteStore(state => state.optimizeRoute);
  const clearActiveRoute = useRouteStore(state => state.clearActiveRoute);
  const ensureActiveRoute = useRouteStore(state => state.ensureActiveRoute);
  const defaultNavigator = useAuthStore(state => state.defaultNavigator);

  const [isFinishing, setIsFinishing] = useState(false);
  const [showFinishSuccessModal, setShowFinishSuccessModal] = useState(false);
  const [finishedDateText, setFinishedDateText] = useState('');

  const isAllCompleted =
    stops.length > 0 &&
    stops.every(s => s.status === 'delivered' || (s.status as string) === 'completed');

  const formatFinishedSuccessDate = (rawDate?: string | null): string => {
    try {
      const base = rawDate
        ? new Date(rawDate.includes('T') ? rawDate : `${rawDate}T12:00:00`)
        : new Date();
      const day = base.getDate();
      const month = base.toLocaleDateString('es-CO', { month: 'long' });
      const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
      return `${day} de ${capitalizedMonth}`;
    } catch {
      const today = new Date();
      const month = today.toLocaleDateString('es-CO', { month: 'long' });
      const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);
      return `${today.getDate()} de ${capitalizedMonth}`;
    }
  };

  const handleFinishRoute = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    try {
      if (!getAuthToken()) {
        await initAuthToken();
      }
      if (!getAuthToken()) {
        throw new Error(
          'No hay sesión autenticada con el servidor. Inicia sesión con tu cuenta para guardar la ruta en el historial.'
        );
      }

      let activeRouteId = useRouteStore.getState().routeId;
      if (!activeRouteId || !isUuid(activeRouteId)) {
        activeRouteId = await ensureActiveRoute();
      }

      if (!activeRouteId || !isUuid(activeRouteId)) {
        throw new Error(
          'No se pudo sincronizar ni obtener el identificador de la ruta activa en el servidor.'
        );
      }

      // Sincronizar paradas locales que aún no tengan UUID persistido en el backend
      const currentStops = useRouteStore.getState().stops;
      for (const localStop of currentStops) {
        if (!isUuid(localStop.id)) {
          const created = await api.stops.create({
            route_id: activeRouteId,
            address: localStop.address,
            lat: localStop.lat,
            lng: localStop.lng,
            color_code: localStop.colorCode,
            is_pinned: Boolean(localStop.isPinned),
            clients: localStop.clients.map(c => ({
              name: c.name || 'Cliente',
              phone: c.phone || undefined,
              packages_count: c.packages || 1,
              notes: c.notes || undefined,
            })),
          });
          if (localStop.status === 'delivered' || (localStop.status as string) === 'completed') {
            await api.stops.updateStatus(String(created.id), 'delivered');
          }
        }
      }

      const finishedRoute = await api.routes.finish(activeRouteId);
      if (!finishedRoute || finishedRoute.status !== 'completed') {
        throw new Error('El servidor no confirmó la actualización del estado de la ruta.');
      }

      const routeDateValue = finishedRoute.route_date || finishedRoute.finished_at || null;
      const formatted = formatFinishedSuccessDate(routeDateValue);
      setFinishedDateText(formatted);
      setShowFinishSuccessModal(true);
    } catch (err: any) {
      setShowFinishSuccessModal(false);
      Alert.alert(
        'Error al finalizar ruta',
        err?.message || 'No fue posible cerrar la ruta en el servidor.'
      );
    } finally {
      setIsFinishing(false);
    }
  };

  const handleStartNewRoute = () => {
    setShowFinishSuccessModal(false);
    useRouteStore.getState().clearActiveRoute();
  };

  // ── Sync active backend route when authenticated ──────────────────────────
  useEffect(() => {
    initAuthToken()
      .then((token) => {
        if (token || getAuthToken()) {
          return ensureActiveRoute();
        }
      })
      .catch(() => {});
  }, []);

  // ── Listen for address coming back via route params (fallback path) ───────
  useEffect(() => {
    const selectedAddress = route.params?.selectedAddress;
    if (!selectedAddress) return;

    // Clear the param immediately to avoid re-triggering on future renders
    navigation.setParams({ selectedAddress: undefined });

    const existingStop = findStopByAddress(
      useRouteStore.getState().stops,
      selectedAddress.address
    );

    if (existingStop) {
      Alert.alert(
        'Dirección ya registrada',
        '¿Agregar este paquete a un nuevo cliente en esta parada?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Aceptar',
            onPress: () => navigation.navigate('StopDetail', { stopId: existingStop.id }),
          },
        ]
      );
    } else {
      const newStop: Stop = {
        id: `s${Date.now()}`,
        address: selectedAddress.address,
        detail: selectedAddress.detail,
        lat: selectedAddress.lat,
        lng: selectedAddress.lng,
        status: 'pending',
        colorCode: '#3B82F6',
        isPinned: false,
        clients: [],
      };
      navigation.navigate('StopDetail', { tempStop: newStop, isNew: true });
    }
  }, [route.params?.selectedAddress]);

  const handleStatusChange = async (id: string, status: Stop['status']) => {
    updateStopStatus(id, status);
    if (getAuthToken() && isUuid(id)) {
      try {
        await api.stops.updateStatus(id, status);
      } catch (err: any) {
        Alert.alert(
          'Error al actualizar estado',
          err?.message || 'No se pudo actualizar el estado en el servidor.'
        );
      }
    }
  };

  const handleStopPress = (id: string) => {
    navigation.navigate('StopDetail', { stopId: id });
  };

  const handleDragEnd = async ({
    data,
    from,
    to,
  }: {
    data: Stop[];
    from: number;
    to: number;
  }) => {
    if (from === to) return;
    const movedStop = data[to];
    reorderStops(data, movedStop?.id);

    if (getAuthToken()) {
      try {
        const activeRouteId = await ensureActiveRoute();
        const latestStops = useRouteStore.getState().stops;
        const allUuids = latestStops.every(s => isUuid(s.id));
        if (activeRouteId && allUuids) {
          const stopIds = latestStops.map(s => s.id);
          const pinnedIds = latestStops.filter(s => s.isPinned).map(s => s.id);
          const reordered = await api.routes.reorder(activeRouteId, stopIds, pinnedIds);
          const detailById = new Map(latestStops.map(s => [s.id, s.detail]));
          setStops(
            reordered.map(s => mapApiStopToStore(s, detailById.get(String(s.id)) ?? ''))
          );
        }
      } catch (err: any) {
        Alert.alert(
          'Error al reordenar',
          err?.message || 'No se pudo guardar el nuevo orden en el servidor.'
        );
      }
    }
  };

  const handleMenuPress = () => setMenuOpen(true);

  const handleLayerPress = () => {
    setShowsTraffic(prev => !prev);
  };

  const handleMapTypePress = () => {
    setMapType(prev => (prev === 'standard' ? 'satellite' : 'standard'));
  };

  const handleSearchPress = () => {
    navigation.navigate('SearchAddress');
  };

  const handleOcrPress = () => {
    navigation.navigate('Scanner');
  };

  const handleTogglePin = async (stopId: string, pinned: boolean) => {
    updateStop(stopId, { isPinned: pinned });
    if (getAuthToken() && isUuid(stopId)) {
      try {
        await api.stops.update(stopId, { is_pinned: pinned });
      } catch (err: any) {
        console.warn('Error al actualizar pin en servidor:', err?.message);
      }
    }
  };

  const runLocalOptimization = (originLat: number, originLon: number) => {
    const currentStops = [...useRouteStore.getState().stops];
    const total = currentStops.length;
    if (total <= 1) {
      optimizeRoute();
      return;
    }

    const pinnedStops = currentStops.filter(s => s.isPinned);
    const unpinnedStops = currentStops.filter(s => !s.isPinned);

    // Ordenar paradas libres usando el vecino más cercano (greedy TSP)
    let currentLat = originLat;
    let currentLon = originLon;
    const remaining = [...unpinnedStops];
    const sortedUnpinned: Stop[] = [];

    while (remaining.length > 0) {
      let nearestIdx = 0;
      let minDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const dLat = remaining[i].lat - currentLat;
        const dLng = remaining[i].lng - currentLon;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < minDistance) {
          minDistance = dist;
          nearestIdx = i;
        }
      }

      const [nearest] = remaining.splice(nearestIdx, 1);
      sortedUnpinned.push(nearest);
      currentLat = nearest.lat;
      currentLon = nearest.lng;
    }

    // Ensamblar casillas respetando paradas fijadas
    const result: Array<Stop | null> = new Array(total).fill(null);
    const occupied = new Set<number>();

    // 1. Asignar casillas fijas a paradas bloqueadas
    pinnedStops.forEach((p, idx) => {
      const preferred = (p.sequenceOrder && p.sequenceOrder >= 1) ? p.sequenceOrder - 1 : idx;
      let slot = preferred;
      if (slot >= total || occupied.has(slot)) {
        slot = result.findIndex((_, i) => !occupied.has(i));
      }
      if (slot !== -1) {
        result[slot] = p;
        occupied.add(slot);
      }
    });

    // 2. Llenar huecos con las no bloqueadas
    let unpinnedIdx = 0;
    for (let i = 0; i < total; i++) {
      if (result[i] === null) {
        result[i] = sortedUnpinned[unpinnedIdx] ?? unpinnedStops[unpinnedIdx];
        unpinnedIdx++;
      }
    }

    const finalStops = result
      .filter((s): s is Stop => s !== null)
      .map((s, idx) => ({ ...s, sequenceOrder: idx + 1 }));

    setStops(finalStops, true);
  };

  const handleOptimize = () => {
    if (stops.length === 0) {
      Alert.alert('Sin paradas', 'Agrega al menos una parada para optimizar la ruta.');
      return;
    }
    setShowOptConfig(true);
  };

  const executeOptimization = async () => {
    if (startType === 'address' && !startAddrInput.trim()) {
      Alert.alert(
        'Dirección requerida',
        'Por favor ingresa la dirección de partida o selecciona "Mi ubicación actual".'
      );
      return;
    }
    if (endType === 'address' && !endAddrInput.trim()) {
      Alert.alert(
        'Dirección requerida',
        'Por favor ingresa la dirección de llegada o selecciona otra opción de destino.'
      );
      return;
    }

    setShowOptConfig(false);
    setIsOptimizing(true);

    try {
      let originLat = currentRegionRef.current.latitude;
      let originLon = currentRegionRef.current.longitude;
      let startLocation: { lat: number; lng: number } | undefined = undefined;

      if (startType === 'current') {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            originLat = pos.coords.latitude;
            originLon = pos.coords.longitude;
          }
        } catch {}
        startLocation = { lat: originLat, lng: originLon };
      }

      let returnToDepot = false;
      let endLocation: { lat: number; lng: number } | undefined = undefined;
      let startAddressPayload: string | undefined = undefined;
      let endAddressPayload: string | undefined = undefined;

      if (startType === 'address') {
        startAddressPayload = startAddrInput.trim();
      }

      if (endType === 'return_start') {
        returnToDepot = true;
        if (startLocation) {
          endLocation = startLocation;
        } else if (startAddressPayload) {
          endAddressPayload = startAddressPayload;
        }
      } else if (endType === 'address') {
        endAddressPayload = endAddrInput.trim();
      }

      let optimizedOnBackend = false;

      if (getAuthToken()) {
        try {
          const activeRouteId = await ensureActiveRoute();
          if (activeRouteId) {
            const payload: any = {
              return_to_depot: returnToDepot,
            };
            if (startLocation) {
              payload.start_location = startLocation;
            }
            if (startAddressPayload) {
              payload.start_address = startAddressPayload;
            }
            if (endLocation) {
              payload.end_location = endLocation;
            }
            if (endAddressPayload) {
              payload.end_address = endAddressPayload;
            }

            const result = await api.routes.optimize(activeRouteId, payload);
            if (result && result.stops && result.stops.length > 0) {
              const currentStops = useRouteStore.getState().stops;
              const detailById = new Map(
                currentStops.map(s => [s.id, s.detail])
              );
              const detailByAddr = new Map(
                currentStops.map(s => [s.address.trim().toLowerCase(), s.detail])
              );
              const updatedStops = result.stops.map(s =>
                mapApiStopToStore(
                  s,
                  detailById.get(String(s.id)) ??
                    detailByAddr.get(s.address.trim().toLowerCase()) ??
                    ''
                )
              );

              // Resguardo crítico: garantizar que NINGUNA parada se pierda
              const returnedIds = new Set(updatedStops.map(s => s.id));
              const missingStops = currentStops.filter(s => !returnedIds.has(s.id));
              setStops([...updatedStops, ...missingStops], true);
              optimizedOnBackend = true;
            }
          }
        } catch (apiErr: any) {
          console.warn('Backend optimize fallback:', apiErr?.message);
        }
      }

      if (!optimizedOnBackend) {
        runLocalOptimization(originLat, originLon);
      }
    } catch (err: any) {
      Alert.alert(
        'Error al optimizar ruta',
        err?.message || 'No se pudo optimizar la ruta en el servidor.'
      );
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleNextStop = async () => {
    if (stops.length === 0) {
      Alert.alert('Sin paradas', 'Agrega al menos una parada para iniciar el recorrido.');
      return;
    }

    const nextStop = stops.find(s => s.status !== 'delivered');
    if (!nextStop) {
      Alert.alert(
        '¡Felicitaciones!',
        'Has completado todas las paradas de tu ruta de hoy.'
      );
      return;
    }

    const { lat, lng } = nextStop;
    const primaryUrl =
      defaultNavigator === 'waze'
        ? `waze://?ll=${lat},${lng}&navigate=yes`
        : `google.navigation:q=${lat},${lng}`;

    const fallbackUrl =
      defaultNavigator === 'waze'
        ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

    try {
      await Linking.openURL(primaryUrl);
    } catch {
      await Linking.openURL(fallbackUrl);
    }
  };

  const getMarkerColor = (status: Stop['status'], colorCode: string) => {
    if (status === 'delivered') return '#10B981';
    if (status === 'failed') return '#EF4444';
    return colorCode;
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      {/* ── Full-screen map ────────────────────────────────────────────────── */}
      <MapView
        key={`map-${stops.map(s => s.id).join('-')}`}
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={currentRegionRef.current}
        onRegionChangeComplete={(region) => {
          currentRegionRef.current = region;
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsTraffic={showsTraffic}
        mapType={mapType}
      >
        {stops.map((stop, index) => {
          const markerColor = getMarkerColor(stop.status, stop.colorCode);
          const showNumberedPin = isOptimized || stop.isPinned;
          const displayNum = needsReoptimization && !stop.isPinned ? '-' : (stop.sequenceOrder ?? index + 1);

          return (
            <Marker
              key={`${stop.id}-${stop.status}-${stop.colorCode}-${isOptimized ? index + 1 : 'pin'}-${stop.isPinned ? 'p' : 'u'}`}
              coordinate={{ latitude: stop.lat, longitude: stop.lng }}
              pinColor={showNumberedPin ? undefined : markerColor}
              title={stop.address}
              description={stop.detail}
              onPress={(e) => {
                e?.stopPropagation?.();
                navigation.navigate('StopDetail', { stopId: stop.id });
              }}
              onCalloutPress={() => {
                navigation.navigate('StopDetail', { stopId: stop.id });
              }}
            >
              {showNumberedPin ? (
                <View style={styles.markerWrapper} pointerEvents="none">
                  <View style={[styles.markerPin, { backgroundColor: markerColor }]}>
                    <Text style={styles.markerNumber}>{displayNum}</Text>
                  </View>
                  <View style={[styles.markerArrow, { borderTopColor: markerColor }]} />
                </View>
              ) : null}
            </Marker>
          );
        })}
      </MapView>

      {/* ── Top-left: hamburger menu ───────────────────────────────────────── */}
      <SafeAreaView style={styles.topControls} pointerEvents="box-none">
        <FloatButton onPress={handleMenuPress} style={styles.menuBtn}>
          <Ionicons name="menu" size={24} color={PALETTE.textPrimary} />
        </FloatButton>
      </SafeAreaView>

      {/* ── Right-side map controls ────────────────────────────────────────── */}
      <Animated.View
        style={[styles.rightControls, { bottom: Animated.add(sheetHeight, 16) }]}
        pointerEvents="box-none"
      >
        <FloatButton
          onPress={handleLayerPress}
          style={showsTraffic ? styles.floatBtnActive : undefined}
        >
          <Ionicons
            name="layers-outline"
            size={22}
            color={showsTraffic ? PALETTE.white : PALETTE.emerald}
          />
        </FloatButton>
        <FloatButton
          onPress={handleMapTypePress}
          style={mapType === 'satellite' ? styles.floatBtnActive : styles.mapTypeBtn}
        >
          <Ionicons
            name="map-outline"
            size={22}
            color={mapType === 'satellite' ? PALETTE.white : PALETTE.textSecondary}
          />
        </FloatButton>
      </Animated.View>

      {/* ── Collapsible Bottom sheet ──────────────────────────────────────── */}
      <Animated.View style={[styles.bottomSheet, { height: sheetHeight }]}>

        {/* Drag handle + Header zone (draggable & tappable to collapse/expand) */}
        <View {...sheetPanResponder.panHandlers}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={toggleSheetCollapse}
            style={styles.dragHandleTouchArea}
          >
            <View style={styles.dragHandle} />
          </TouchableOpacity>

          {/* ── Header row: stop count + actions ─────────────────────────── */}
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={toggleSheetCollapse} activeOpacity={0.7}>
              <Text style={styles.stopCount}>{stops.length} paradas</Text>
            </TouchableOpacity>
            <View style={styles.sheetActions}>
              <TouchableOpacity
                onPress={toggleSheetCollapse}
                accessibilityRole="button"
                accessibilityLabel={snapIndex === 0 ? 'Expandir panel' : 'Colapsar panel'}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name={snapIndex === 0 ? 'chevron-up' : 'chevron-down'}
                  size={22}
                  color={PALETTE.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={{ marginLeft: 16 }}
                accessibilityRole="button"
                accessibilityLabel="More options"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="ellipsis-vertical" size={22} color={PALETTE.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Search / OCR bar ───────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={handleSearchPress}
          activeOpacity={0.75}
          accessibilityRole="search"
          accessibilityLabel="Buscar dirección manual"
        >
          <Ionicons
            name="search-outline"
            size={18}
            color={PALETTE.textSecondary}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.searchPlaceholder}>Buscar dirección manual...</Text>
          <TouchableOpacity
            onPress={handleOcrPress}
            style={styles.ocrBtn}
            accessibilityRole="button"
            accessibilityLabel="Escanear etiqueta con cámara"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialCommunityIcons
              name="barcode-scan"
              size={22}
              color={PALETTE.emerald}
            />
          </TouchableOpacity>
        </TouchableOpacity>

        {/* ── Stop list (DraggableFlatList) ──────────────────────────────── */}
        <View style={styles.stopList}>
          <DraggableFlatList
            data={stops}
            keyExtractor={(item) => item.id}
            scrollEnabled={snapIndex > 0}
            showsVerticalScrollIndicator={false}
            onDragEnd={handleDragEnd}
            renderItem={({ item, getIndex, drag, isActive }: RenderItemParams<Stop>) => (
              <StopRow
                stop={item}
                index={getIndex() ?? 0}
                drag={drag}
                isActive={isActive}
                onStatusChange={handleStatusChange}
                onStopPress={handleStopPress}
                onTogglePin={handleTogglePin}
                needsReoptimization={needsReoptimization}
              />
            )}
          />
        </View>

        {/* ── Next stop & Optimise route CTAs ────────────────────────────── */}
        <View style={styles.ctaRow}>
          {isAllCompleted ? (
            <TouchableOpacity
              style={styles.finishRouteBtn}
              onPress={handleFinishRoute}
              disabled={isFinishing}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Finalizar Ruta"
            >
              {isFinishing ? (
                <ActivityIndicator
                  size="small"
                  color={PALETTE.white}
                  style={{ marginRight: 8 }}
                />
              ) : (
                <Ionicons
                  name="checkmark-done-circle"
                  size={22}
                  color={PALETTE.white}
                  style={{ marginRight: 8 }}
                />
              )}
              <Text style={styles.finishRouteBtnText}>
                {isFinishing ? 'Finalizando...' : 'Finalizar Ruta'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.nextStopBtn}
              onPress={handleNextStop}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Ir a la siguiente parada"
            >
              <Ionicons
                name="navigate"
                size={20}
                color={PALETTE.white}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.nextStopBtnText}>Ir a la siguiente parada</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.optimizeBtn,
              needsReoptimization && styles.reoptimizeBtnActive,
              (!needsReoptimization && isOptimized) && styles.optimizeBtnDisabled,
            ]}
            onPress={handleOptimize}
            disabled={isOptimizing || (!needsReoptimization && isOptimized)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={needsReoptimization ? 'Reoptimizar ruta' : 'Optimizar ruta'}
          >
            {isOptimizing ? (
              <ActivityIndicator
                size="small"
                color={needsReoptimization ? '#FFFFFF' : PALETTE.forestGreen}
                style={{ marginRight: 6 }}
              />
            ) : (
              <Ionicons
                name={needsReoptimization ? 'flash' : 'refresh-circle-outline'}
                size={22}
                color={
                  needsReoptimization
                    ? '#FFFFFF'
                    : (!needsReoptimization && isOptimized)
                    ? PALETTE.textSecondary
                    : PALETTE.forestGreen
                }
                style={{ marginRight: 6 }}
              />
            )}
            <Text
              style={[
                styles.optimizeBtnText,
                needsReoptimization && styles.reoptimizeBtnTextActive,
                (!needsReoptimization && isOptimized) && styles.optimizeBtnTextDisabled,
              ]}
            >
              {isOptimizing
                ? 'Optimizando...'
                : needsReoptimization
                ? 'Reoptimizar ruta'
                : isOptimized
                ? 'Ruta optimizada'
                : 'Optimizar ruta'}
            </Text>
          </TouchableOpacity>
        </View>

      </Animated.View>

      {/* ── Modal de Configuración de Optimización ────────────────────────── */}
      <Modal
        visible={showOptConfig}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptConfig(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.optConfigOverlay}
        >
          <View style={styles.optConfigCard}>
            <View style={styles.optConfigHeader}>
              <View style={styles.optConfigIconBadge}>
                <Ionicons name="options-outline" size={20} color={PALETTE.forestGreen} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optConfigTitle}>Configuración de Optimización</Text>
                <Text style={styles.optConfigSubtitle}>Define los puntos de partida y llegada</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowOptConfig(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={PALETTE.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {/* Sección: Punto de Partida */}
              <Text style={styles.optSectionTitle}>Punto de partida</Text>
              <TouchableOpacity
                style={[styles.optOptionRow, startType === 'current' && styles.optOptionRowActive]}
                onPress={() => setStartType('current')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={startType === 'current' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={startType === 'current' ? PALETTE.forestGreen : PALETTE.textSecondary}
                  style={{ marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optOptionLabel, startType === 'current' && styles.optOptionLabelActive]}>
                    Mi ubicación actual (GPS)
                  </Text>
                  <Text style={styles.optOptionHint}>Empieza la ruta desde tu posición en tiempo real</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optOptionRow, startType === 'address' && styles.optOptionRowActive]}
                onPress={() => setStartType('address')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={startType === 'address' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={startType === 'address' ? PALETTE.forestGreen : PALETTE.textSecondary}
                  style={{ marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optOptionLabel, startType === 'address' && styles.optOptionLabelActive]}>
                    Ingresar dirección de partida
                  </Text>
                  <Text style={styles.optOptionHint}>Bodega de despacho o punto de inicio personalizado</Text>
                </View>
              </TouchableOpacity>

              {startType === 'address' && (
                <TextInput
                  style={styles.optTextInput}
                  value={startAddrInput}
                  onChangeText={setStartAddrInput}
                  placeholder="Ej: Calle 166 # 9-24, Usaquén"
                  placeholderTextColor={PALETTE.textSecondary}
                  autoCapitalize="sentences"
                />
              )}

              {/* Sección: Punto de Llegada */}
              <Text style={[styles.optSectionTitle, { marginTop: 16 }]}>Punto de llegada</Text>
              
              <TouchableOpacity
                style={[styles.optOptionRow, endType === 'last_stop' && styles.optOptionRowActive]}
                onPress={() => setEndType('last_stop')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={endType === 'last_stop' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={endType === 'last_stop' ? PALETTE.forestGreen : PALETTE.textSecondary}
                  style={{ marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optOptionLabel, endType === 'last_stop' && styles.optOptionLabelActive]}>
                    Terminar en la última parada
                  </Text>
                  <Text style={styles.optOptionHint}>Ruta abierta, termina donde entregues el último paquete</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optOptionRow, endType === 'return_start' && styles.optOptionRowActive]}
                onPress={() => setEndType('return_start')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={endType === 'return_start' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={endType === 'return_start' ? PALETTE.forestGreen : PALETTE.textSecondary}
                  style={{ marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optOptionLabel, endType === 'return_start' && styles.optOptionLabelActive]}>
                    Volver al punto de partida
                  </Text>
                  <Text style={styles.optOptionHint}>Ruta circular, retorna al origen o bodega al finalizar</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optOptionRow, endType === 'address' && styles.optOptionRowActive]}
                onPress={() => setEndType('address')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={endType === 'address' ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={endType === 'address' ? PALETTE.forestGreen : PALETTE.textSecondary}
                  style={{ marginRight: 10 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optOptionLabel, endType === 'address' && styles.optOptionLabelActive]}>
                    Ingresar dirección personalizada
                  </Text>
                  <Text style={styles.optOptionHint}>Terminar en tu casa, bodega u otra ubicación</Text>
                </View>
              </TouchableOpacity>

              {endType === 'address' && (
                <TextInput
                  style={styles.optTextInput}
                  value={endAddrInput}
                  onChangeText={setEndAddrInput}
                  placeholder="Ej: Carrera 7 # 32-15, Bodega Central"
                  placeholderTextColor={PALETTE.textSecondary}
                  autoCapitalize="sentences"
                />
              )}
            </ScrollView>

            {/* Botones de acción */}
            <View style={styles.optConfigActions}>
              <TouchableOpacity
                style={styles.optConfigCancelBtn}
                onPress={() => setShowOptConfig(false)}
              >
                <Text style={styles.optConfigCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.optConfigConfirmBtn}
                onPress={executeOptimization}
                activeOpacity={0.85}
              >
                <Ionicons name="flash" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.optConfigConfirmText}>Optimizar ahora</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Modal de Carga de Optimización ─────────────────────────────────── */}
      <Modal transparent visible={isOptimizing} animationType="fade">
        <View style={styles.loadingModalOverlay}>
          <View style={styles.loadingModalCard}>
            <ActivityIndicator size="large" color={PALETTE.emerald} style={{ marginBottom: 14 }} />
            <Text style={styles.loadingModalTitle}>Optimizando tu ruta...</Text>
            <Text style={styles.loadingModalSubtitle}>Calculando el recorrido más eficiente con IA</Text>
          </View>
        </View>
      </Modal>

      {/* ── Modal de Éxito al Finalizar Ruta ─────────────────────────────── */}
      <Modal
        visible={showFinishSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.successModalOverlay}>
          <View style={styles.successModalCard}>
            <View style={styles.successModalIconBadge}>
              <Ionicons name="checkmark-circle" size={54} color={PALETTE.emerald} />
            </View>
            <Text style={styles.successModalTitle}>¡Ruta Finalizada!</Text>
            <Text style={styles.successModalSubtitle}>
              La ruta para el {finishedDateText || 'día de hoy'} quedó guardada en el historial.
            </Text>
            <TouchableOpacity
              style={styles.successModalButton}
              onPress={handleStartNewRoute}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Iniciar nueva ruta"
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.successModalButtonText}>Iniciar nueva ruta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({

  // ── Root ──────────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: PALETTE.lightGray,
  },

  // ── Floating buttons (shared) ──────────────────────────────────────────────
  floatBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: PALETTE.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 5,
  },
  floatBtnActive: {
    backgroundColor: PALETTE.forestGreen,
  },

  // ── Top controls ──────────────────────────────────────────────────────────
  topControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  menuBtn: {
    // inherits floatBtn
  },

  // ── Right side controls ────────────────────────────────────────────────────
  rightControls: {
    position: 'absolute',
    right: 16,
    bottom: 260,          // above bottom sheet
    alignItems: 'center',
    gap: 10,
  },
  mapTypeBtn: {
    // inherits floatBtn
  },

  // ── Bottom sheet ──────────────────────────────────────────────────────────
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: PALETTE.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'android' ? 20 : 34,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 16,
  },

  // ── Drag handle ───────────────────────────────────────────────────────────
  dragHandleTouchArea: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PALETTE.border,
    alignSelf: 'center',
  },

  // ── Sheet header ──────────────────────────────────────────────────────────
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stopCount: {
    fontSize: 17,
    fontWeight: '600',
    color: PALETTE.textPrimary,
  },
  sheetActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // ── Search / OCR bar ──────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PALETTE.lightGray,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: PALETTE.textSecondary,
  },
  ocrBtn: {
    padding: 4,
  },

  // ── Stop list ─────────────────────────────────────────────────────────────
  stopList: {
    flex: 1,
    marginBottom: 16,
  },

  // ── Numbered map markers (when route is optimized) ────────────────────────
  markerWrapper: {
    alignItems: 'center',
  },
  markerPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  markerNumber: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.border,
    backgroundColor: '#FFF',
  },
  stopRowActive: {
    backgroundColor: '#ECFDF5',
    elevation: 4,
  },
  stopIndex: {
    width: 32,
    alignItems: 'flex-start',
  },
  stopIndexText: {
    fontSize: 13,
    fontWeight: '600',
    color: PALETTE.textSecondary,
  },
  stopIndexTextUnoptimized: {
    fontSize: 16,
    fontWeight: '800',
    color: '#94A3B8',
  },
  stopInfo: {
    flex: 1,
    paddingRight: 8,
  },
  stopAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stopAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: PALETTE.textPrimary,
    flexShrink: 1,
  },
  pinnedBadge: {
    marginLeft: 6,
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  stopDetail: {
    fontSize: 12,
    color: PALETTE.textSecondary,
    marginTop: 2,
  },
  stopDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PALETTE.emerald,
    opacity: 0.5,
  },
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  swipeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },

  // ── Next Stop & Optimise CTAs ─────────────────────────────────────────────
  ctaRow: {
    gap: 10,
  },
  nextStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PALETTE.forestGreen,
    borderRadius: 14,
    height: 54,
    shadowColor: PALETTE.forestGreen,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  nextStopBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: PALETTE.white,
    letterSpacing: 0.3,
  },
  finishRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    borderRadius: 14,
    height: 54,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
    borderWidth: 1.5,
    borderColor: '#34D399',
  },
  finishRouteBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: PALETTE.white,
    letterSpacing: 0.3,
  },
  optimizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: PALETTE.emerald,
    borderRadius: 14,
    height: 48,
  },
  reoptimizeBtnActive: {
    backgroundColor: '#EA580C',
    borderColor: '#F97316',
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  optimizeBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#CBD5E1',
    opacity: 0.85,
  },
  optimizeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.forestGreen,
    letterSpacing: 0.2,
  },
  reoptimizeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  optimizeBtnTextDisabled: {
    color: '#64748B',
  },
  loadingModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    maxWidth: 320,
    width: '100%',
  },
  loadingModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  loadingModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },

  // ── Optimization Config Modal ──────────────────────────────────────────
  optConfigOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  optConfigCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  optConfigHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  optConfigIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(6, 95, 70, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optConfigTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: PALETTE.textPrimary,
  },
  optConfigSubtitle: {
    fontSize: 12,
    color: PALETTE.textSecondary,
    marginTop: 2,
  },
  optSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: PALETTE.forestGreen,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  optOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  optOptionRowActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderColor: PALETTE.emerald,
  },
  optOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PALETTE.textPrimary,
  },
  optOptionLabelActive: {
    color: PALETTE.forestGreen,
    fontWeight: '700',
  },
  optOptionHint: {
    fontSize: 11,
    color: PALETTE.textSecondary,
    marginTop: 2,
  },
  optTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: PALETTE.emerald,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: PALETTE.textPrimary,
    marginBottom: 8,
  },
  optConfigActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
  },
  optConfigCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optConfigCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: PALETTE.textSecondary,
  },
  optConfigConfirmBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: PALETTE.emerald,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PALETTE.emerald,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  optConfigConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Finalize Route Success Modal ──────────────────────────────────────
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  successModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 10,
    width: '100%',
    maxWidth: 340,
  },
  successModalIconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    textAlign: 'center',
  },
  successModalSubtitle: {
    fontSize: 15,
    color: '#334155',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  successModalButton: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#065F46',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#065F46',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  successModalButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
