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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { api, getAuthToken, Route } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';

export default function RouteHistoryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isGuest = useAuthStore(state => state.isGuest);

  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (isGuest || !getAuthToken()) {
      setRoutes([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      let data = await api.routes.getHistory();
      if (!data || data.length === 0) {
        data = await api.routes.list('completed');
      }
      setRoutes(data || []);
    } catch {
      try {
        const fallback = await api.routes.list('completed');
        setRoutes(fallback || []);
      } catch {
        setRoutes([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isGuest]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const formatRouteDateTitle = (dateStr?: string | null) => {
    if (!dateStr) return '';
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
        return `${dayNum} de ${capitalizedMonth}`;
      }
      return dateStr;
    } catch {
      return dateStr || '';
    }
  };

  const routeTitles = useMemo(() => {
    const groupedByDate: Record<string, Route[]> = {};
    for (const r of routes) {
      const dateKey = (r.route_date || r.created_at || '').split('T')[0];
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(r);
    }

    const titleMap = new Map<string, string>();

    for (const [dateKey, dayRoutes] of Object.entries(groupedByDate)) {
      // Ordenar ascendentemente por hora de creación o finalización
      const sortedAsc = [...dayRoutes].sort((a, b) => {
        const timeA = new Date(a.finished_at || a.created_at || `${a.route_date}T00:00:00`).getTime();
        const timeB = new Date(b.finished_at || b.created_at || `${b.route_date}T00:00:00`).getTime();
        return timeA - timeB;
      });

      const hasMultiple = sortedAsc.length > 1;

      sortedAsc.forEach((r, index) => {
        const dateFormatted = formatRouteDateTitle(r.route_date || dateKey);
        const title = hasMultiple
          ? `Ruta ${dateFormatted} (${index + 1})`
          : `Ruta ${dateFormatted}`;
        titleMap.set(r.id, title);
      });
    }

    return titleMap;
  }, [routes]);

  const formatFinishedTime = (dateStr?: string | null) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return null;
    }
  };

  const renderRouteCard = ({ item }: { item: Route }) => {
    const total = item.total_stops || 0;
    const completed = item.completed_stops || 0;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const isCompleted = item.status === 'completed' || (total > 0 && completed >= total);
    const finishedTime = formatFinishedTime(item.finished_at);
    const cardTitle = routeTitles.get(item.id) || `Ruta ${formatRouteDateTitle(item.route_date)}`;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={() =>
          navigation.navigate('RouteDetail', {
            routeId: item.id,
            routeTitle: cardTitle,
          })
        }
      >
        <View style={styles.cardHeader}>
          <View style={styles.dateBlock}>
            <Ionicons name="calendar-outline" size={16} color="#065F46" style={{ marginRight: 6 }} />
            <Text style={styles.dateText}>{cardTitle}</Text>
          </View>
          <View style={[styles.badge, isCompleted ? styles.badgeSuccess : styles.badgeProgress]}>
            <Text style={[styles.badgeText, isCompleted ? styles.badgeTextSuccess : styles.badgeTextProgress]}>
              {isCompleted ? 'Completada' : 'En Progreso'}
            </Text>
          </View>
        </View>

        {finishedTime && (
          <View style={styles.finishTimeRow}>
            <Ionicons name="time-outline" size={14} color="#065F46" style={{ marginRight: 6 }} />
            <Text style={styles.finishTimeText}>Hora de fin: {finishedTime}</Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Paradas Totales</Text>
            <Text style={styles.statValue}>{total}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Entregadas</Text>
            <Text style={styles.statValue}>{completed}</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Efectividad</Text>
            <Text style={[styles.statValue, { color: percent >= 80 ? '#10B981' : '#F59E0B' }]}>
              {percent}%
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${Math.min(100, Math.max(4, percent))}%` }]} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historial de Rutas</Text>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#065F46" />
          <Text style={styles.loadingText}>Cargando historial...</Text>
        </View>
      ) : routes.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="time-outline" size={56} color="#94A3B8" style={{ marginBottom: 14 }} />
          <Text style={styles.emptyTitle}>Sin rutas completadas</Text>
          <Text style={styles.emptySubtitle}>
            {isGuest
              ? 'En modo invitado las rutas no se almacenan en el historial del servidor. Regístrate para conservar tu historial diario.'
              : 'Aquí aparecerán tus rutas del día a medida que completes entregas.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(item) => item.id}
          renderItem={renderRouteCard}
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
  header: {
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
  headerTitle: {
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
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dateBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  finishTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  finishTimeText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeSuccess: {
    backgroundColor: '#ECFDF5',
  },
  badgeProgress: {
    backgroundColor: '#FEF3C7',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  badgeTextSuccess: {
    color: '#065F46',
  },
  badgeTextProgress: {
    color: '#B45309',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
});
