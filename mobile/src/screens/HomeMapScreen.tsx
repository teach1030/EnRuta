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
  ScrollView,
  Alert,
  Animated,
  PanResponder,
  Linking,
} from 'react-native';
import { useRouteStore, findStopByAddress } from '../store/useRouteStore';
import type { Stop } from '../store/useRouteStore';
import { useAuthStore } from '../store/useAuthStore';
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
export { INITIAL_STOPS } from '../store/useRouteStore';

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

/** Single row in the stop list */
const StopRow: React.FC<{
  stop: Stop;
  index: number;
  onStatusChange: (id: string, status: Stop['status']) => void;
  onStopPress: (id: string) => void;
}> = ({ stop, index, onStatusChange, onStopPress }) => {
  const swipeableRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={LeftSwipeActions}
      renderRightActions={RightSwipeActions}
      onSwipeableOpen={(direction) => {
        if (direction === 'left') onStatusChange(stop.id, 'delivered');
        else if (direction === 'right') onStatusChange(stop.id, 'failed');
        
        swipeableRef.current?.close();
      }}
    >
      <TouchableHighlight onPress={() => onStopPress(stop.id)} underlayColor="#F1F5F9">
        <View style={styles.stopRow}>
          {/* Index badge */}
          <View style={styles.stopIndex}>
            <Text style={styles.stopIndexText}>{String(index + 1).padStart(2, '0')}</Text>
          </View>
          {/* Address block */}
          <View style={styles.stopInfo}>
            <Text style={styles.stopAddress}>{stop.address}</Text>
            <Text style={styles.stopDetail}>{stop.detail}</Text>
          </View>
          {/* Status indicator */}
          {stop.status === 'pending' && <View style={[styles.stopDot, { backgroundColor: stop.colorCode }]} />}
          {stop.status === 'delivered' && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
          {stop.status === 'failed' && <Ionicons name="close-circle" size={20} color="#EF4444" />}
        </View>
      </TouchableHighlight>
    </Swipeable>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────

const { width, height: SCREEN_H } = Dimensions.get('window');

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
  const updateStopStatus = useRouteStore(state => state.updateStopStatus);
  const optimizeRoute = useRouteStore(state => state.optimizeRoute);
  const defaultNavigator = useAuthStore(state => state.defaultNavigator);

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
        clients: [],
      };
      navigation.navigate('StopDetail', { tempStop: newStop, isNew: true });
    }
  }, [route.params?.selectedAddress]);

  const handleStatusChange = (id: string, status: Stop['status']) => {
    updateStopStatus(id, status);
  };

  const handleStopPress = (id: string) => {
    navigation.navigate('StopDetail', { stopId: id });
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

  const handleOptimize = () => {
    optimizeRoute();
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
          return (
            <Marker
              key={`${stop.id}-${stop.status}-${stop.colorCode}-${isOptimized ? index + 1 : 'pin'}`}
              coordinate={{ latitude: stop.lat, longitude: stop.lng }}
              pinColor={isOptimized ? undefined : markerColor}
              title={stop.address}
              description={stop.detail}
            >
              {isOptimized ? (
                <View style={styles.markerWrapper}>
                  <View style={[styles.markerPin, { backgroundColor: markerColor }]}>
                    <Text style={styles.markerNumber}>{index + 1}</Text>
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

        {/* ── Stop list ──────────────────────────────────────────────────── */}
        <ScrollView
          style={styles.stopList}
          showsVerticalScrollIndicator={false}
          scrollEnabled={snapIndex > 0}
        >
          {stops.map((stop, index) => (
            <StopRow
              key={stop.id}
              stop={stop}
              index={index}
              onStatusChange={handleStatusChange}
              onStopPress={handleStopPress}
            />
          ))}
        </ScrollView>

        {/* ── Next stop & Optimise route CTAs ────────────────────────────── */}
        <View style={styles.ctaRow}>
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

          <TouchableOpacity
            style={styles.optimizeBtn}
            onPress={handleOptimize}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Optimizar ruta"
          >
            <Ionicons
              name="refresh-circle-outline"
              size={22}
              color={PALETTE.forestGreen}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.optimizeBtnText}>
              {isOptimized ? 'Ruta optimizada' : 'Optimizar ruta'}
            </Text>
          </TouchableOpacity>
        </View>

      </Animated.View>

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
  stopIndex: {
    width: 32,
    alignItems: 'flex-start',
  },
  stopIndexText: {
    fontSize: 13,
    fontWeight: '600',
    color: PALETTE.textSecondary,
  },
  stopInfo: {
    flex: 1,
    paddingRight: 8,
  },
  stopAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: PALETTE.textPrimary,
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
  optimizeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.forestGreen,
    letterSpacing: 0.2,
  },
});
