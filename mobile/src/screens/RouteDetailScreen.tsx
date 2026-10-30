import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { api, initAuthToken, getAuthToken, Route, Stop } from '../services/api';

type DetailRouteProp = RouteProp<RootStackParamList, 'RouteDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'RouteDetail'>;

export default function RouteDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<DetailRouteProp>();
  const { routeId, routeTitle } = route.params;

  const [routeData, setRouteData] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchRouteDetail = useCallback(async () => {
    try {
      setErrorMsg(null);
      if (!getAuthToken()) {
        await initAuthToken();
      }
      const data = await api.routes.get(String(routeId));
      setRouteData(data);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo cargar el detalle de la ruta.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [routeId]);

  useEffect(() => {
    fetchRouteDetail();
  }, [fetchRouteDetail]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchRouteDetail();
  };

  const formatRouteDateTitle = (dateStr?: string | null) => {
    if (!dateStr) return 'Ruta';
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        const dayNum = date.getDate();
        const monthName = date.toLocaleDateString('es-CO', { month: 'long' });
        const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        return `Ruta ${dayNum} de ${capitalizedMonth}`;
      }
      return `Ruta ${dateStr}`;
    } catch {
      return `Ruta ${dateStr}`;
    }
  };

  const formatFinishedTime = (dateStr?: string | null) => {
    if (!dateStr) return 'Sin registro';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Sin registro';
      return date.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'Sin registro';
    }
  };

  const sortedStops = useMemo(() => {
    const rawStops = routeData?.stops ?? [];
    return [...rawStops].sort((a, b) => {
      const seqA = a.sequence_order ?? Number.MAX_SAFE_INTEGER;
      const seqB = b.sequence_order ?? Number.MAX_SAFE_INTEGER;
      return seqA - seqB;
    });
  }, [routeData?.stops]);

  const extractAddressAndLocality = (stop: Stop): { primaryAddress: string; locality: string } => {
    const rawAddress = (stop.address || '').trim();
    const explicitDetail = (stop.detail || '').trim();

    if (explicitDetail) {
      return { primaryAddress: rawAddress, locality: explicitDetail };
    }

    const parts = rawAddress
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    if (parts.length > 1) {
      return {
        primaryAddress: parts[0],
        locality: parts.slice(1).join(', '),
      };
    }

    const clientNotes = (stop.clients ?? [])
      .map(c => c.notes?.trim())
      .filter(Boolean)
      .join(' · ');

    return {
      primaryAddress: rawAddress,
      locality: clientNotes || 'Bogotá D.C.',
    };
  };

  const headerTitle =
    routeTitle ||
    (routeData ? formatRouteDateTitle(routeData.route_date) : 'Detalle de Ruta');

  const totalDeliveries =
    routeData?.completed_stops ||
    routeData?.total_stops ||
    sortedStops.length ||
    0;

  const finishedTimeText = formatFinishedTime(
    routeData?.finished_at || routeData?.optimization_metadata?.finished_at
  );

  const renderStopItem = ({ item, index }: { item: Stop; index: number }) => {
    const sequenceNumber = item.sequence_order ?? index + 1;
    const { primaryAddress, locality } = extractAddressAndLocality(item);

    return (
      <View style={styles.stopCard}>
        <View style={styles.sequenceBadge}>
          <Text style={styles.sequenceText}>{sequenceNumber}</Text>
        </View>

        <View style={styles.stopInfo}>
          <Text style={styles.stopAddress} numberOfLines={2}>
            {primaryAddress}
          </Text>
          <View style={styles.localityRow}>
            <Ionicons name="location-outline" size={13} color="#64748B" style={{ marginRight: 4 }} />
            <Text style={styles.stopLocality} numberOfLines={1}>
              {locality}
            </Text>
          </View>
        </View>

        <View style={styles.checkmarkContainer}>
          <Ionicons name="checkmark-circle" size={24} color="#10B981" />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Barra superior */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver al historial"
        >
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>
          Detalle de Ruta
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#065F46" />
          <Text style={styles.loadingText}>Cargando paradas de la ruta...</Text>
        </View>
      ) : errorMsg ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" style={{ marginBottom: 12 }} />
          <Text style={styles.errorTitle}>Error al cargar la ruta</Text>
          <Text style={styles.errorSubtitle}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={fetchRouteDetail}>
            <Text style={styles.retryBtnText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={sortedStops}
          keyExtractor={(item, idx) => String(item.id || idx)}
          renderItem={renderStopItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#065F46']}
              tintColor="#065F46"
            />
          }
          ListHeaderComponent={
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeaderRow}>
                <View style={styles.routeIconBadge}>
                  <Ionicons name="map-outline" size={22} color="#065F46" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.routeTitleText}>{headerTitle}</Text>
                  <Text style={styles.routeStatusBadgeText}>Ruta Completada</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Ionicons name="cube-outline" size={18} color="#065F46" style={{ marginBottom: 4 }} />
                  <Text style={styles.metricLabel}>Total de entregas</Text>
                  <Text style={styles.metricValue}>{totalDeliveries}</Text>
                </View>

                <View style={styles.metricVerticalDivider} />

                <View style={styles.metricBox}>
                  <Ionicons name="time-outline" size={18} color="#065F46" style={{ marginBottom: 4 }} />
                  <Text style={styles.metricLabel}>Hora de finalización</Text>
                  <Text style={styles.metricValue}>{finishedTimeText}</Text>
                </View>
              </View>

              <Text style={styles.sectionHeaderTitle}>
                Paradas realizadas ({sortedStops.length})
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyStopsContainer}>
              <Ionicons name="location-outline" size={40} color="#94A3B8" style={{ marginBottom: 8 }} />
              <Text style={styles.emptyStopsText}>
                No hay paradas registradas para esta ruta.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 4,
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#065F46',
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  routeTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  routeStatusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#065F46',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  metricBox: {
    flex: 1,
    alignItems: 'center',
  },
  metricVerticalDivider: {
    width: 1,
    height: 36,
    backgroundColor: '#E2E8F0',
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stopCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sequenceBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#065F46',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sequenceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stopInfo: {
    flex: 1,
    marginRight: 10,
  },
  stopAddress: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  localityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stopLocality: {
    fontSize: 13,
    color: '#64748B',
  },
  checkmarkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  emptyStopsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStopsText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});
