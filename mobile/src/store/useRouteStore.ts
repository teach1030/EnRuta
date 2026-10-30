import { create } from 'zustand';
import { Alert } from 'react-native';
import { useAuthStore } from './useAuthStore';
import { api, getAuthToken, initAuthToken, type Stop as ApiStop } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Client = {
  id: string;
  name: string;
  phone: string;
  packages: number;
  notes: string;
};

export type StopStatus = 'pending' | 'delivered' | 'failed';

export type Stop = {
  id: string;
  address: string;
  detail: string;
  lat: number;
  lng: number;
  status: StopStatus;
  colorCode: string;
  isPinned?: boolean;
  sequenceOrder?: number;
  clients: Client[];
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID_REGEX.test(value);

export const mapApiStopToStore = (s: ApiStop, fallbackDetail = ''): Stop => ({
  id: String(s.id),
  address: s.address,
  detail: s.detail ?? fallbackDetail,
  lat: s.lat ?? 4.6097,
  lng: s.lng ?? -74.0817,
  status: s.status ?? 'pending',
  colorCode: s.color_code ?? s.colorCode ?? '#3B82F6',
  isPinned: Boolean(s.is_pinned ?? s.isPinned),
  sequenceOrder: s.sequence_order,
  clients: (s.clients ?? []).map((c, idx) => ({
    id: c.id ? String(c.id) : `c-${s.id}-${idx}`,
    name: c.name ?? '',
    phone: c.phone ?? '',
    packages: c.packages_count ?? c.packages ?? 1,
    notes: c.notes ?? '',
  })),
});

// ─── Store ────────────────────────────────────────────────────────────────────

export const GUEST_MAX_STOPS = 10;

type RouteState = {
  routeId: string | null;
  stops: Stop[];
  isOptimized: boolean;
  needsReoptimization: boolean;
  setRouteId: (routeId: string | null) => void;
  setStops: (stops: Stop[], isOptimized?: boolean) => void;
  setNeedsReoptimization: (val: boolean) => void;
  addStop: (stop: Stop) => boolean;
  updateStop: (id: string, changes: Partial<Omit<Stop, 'id'>>) => void;
  removeStop: (id: string) => void;
  updateStopStatus: (id: string, status: StopStatus) => void;
  reorderStops: (newStops: Stop[], pinnedStopId?: string) => void;
  optimizeRoute: () => void;
  clearActiveRoute: () => void;
  ensureActiveRoute: () => Promise<string | null>;
};

export const useRouteStore = create<RouteState>((set, get) => ({
  routeId: null,
  stops: [],
  isOptimized: false,
  needsReoptimization: false,

  setRouteId: (routeId) => set({ routeId }),

  setNeedsReoptimization: (needsReoptimization) => set({ needsReoptimization }),

  setStops: (stops, isOptimized) =>
    set((state) => ({
      stops,
      isOptimized: isOptimized !== undefined ? isOptimized : state.isOptimized,
      needsReoptimization: isOptimized ? false : state.needsReoptimization,
    })),

  addStop: (stop) => {
    const { isGuest } = useAuthStore.getState();
    const currentStops = get().stops;

    if (isGuest && currentStops.length >= GUEST_MAX_STOPS) {
      Alert.alert(
        'Límite de invitado alcanzado',
        'En modo invitado solo puedes agregar hasta 10 paradas. Regístrate o inicia sesión para crear rutas ilimitadas.',
        [{ text: 'Entendido', style: 'default' }]
      );
      return false;
    }

    set((state) => ({
      stops: [...state.stops, stop],
      isOptimized: false,
      needsReoptimization: true,
    }));
    return true;
  },

  updateStop: (id, changes) =>
    set((state) => {
      const isPinChange = changes.isPinned !== undefined;
      const nextStops = state.stops.map((s) => {
        if (s.id === id) {
          return { ...s, ...changes };
        }
        return s;
      });

      return {
        stops: isPinChange
          ? nextStops.map((s) => (s.isPinned ? s : { ...s, sequenceOrder: undefined }))
          : nextStops,
        needsReoptimization: isPinChange ? true : state.needsReoptimization,
        isOptimized: isPinChange ? false : state.isOptimized,
      };
    }),

  removeStop: (id) =>
    set((state) => ({
      stops: state.stops.filter((s) => s.id !== id),
      needsReoptimization: true,
    })),

  updateStopStatus: (id, status) =>
    set((state) => ({
      stops: state.stops.map((s) => (s.id === id ? { ...s, status } : s)),
    })),

  reorderStops: (newStops, pinnedStopId) =>
    set(() => ({
      stops: newStops.map((s, idx) => {
        const isPinned = pinnedStopId ? (s.id === pinnedStopId ? true : s.isPinned) : s.isPinned;
        return {
          ...s,
          sequenceOrder: isPinned ? idx + 1 : undefined,
          isPinned,
        };
      }),
      needsReoptimization: true,
      isOptimized: false,
    })),

  optimizeRoute: () =>
    set((state) => ({
      stops: [...state.stops],
      isOptimized: true,
      needsReoptimization: false,
    })),

  clearActiveRoute: () =>
    set({
      routeId: null,
      stops: [],
      isOptimized: false,
      needsReoptimization: false,
    }),

  ensureActiveRoute: async () => {
    const existingId = get().routeId;
    if (existingId && isUuid(existingId)) {
      return existingId;
    }

    if (!getAuthToken()) {
      await initAuthToken();
    }
    if (!getAuthToken()) {
      return null;
    }

    try {
      const routes = await api.routes.list();
      const active = routes.find((r) => r.status === 'pending' || r.status === 'in_progress');
      if (active) {
        const detail = await api.routes.get(active.id);
        const currentLocalStops = get().stops;
        const detailByAddr = new Map(
          currentLocalStops.map((local) => [local.address.trim().toLowerCase(), local.detail])
        );

        const serverStops = detail.stops ?? [];
        if (serverStops.length > 0) {
          set({
            routeId: detail.id,
            stops: serverStops.map((s) =>
              mapApiStopToStore(s, detailByAddr.get(s.address.trim().toLowerCase()) ?? '')
            ),
          });
        } else {
          set({ routeId: detail.id });
        }
        return detail.id;
      }

      const today = new Date().toISOString().split('T')[0];
      const localStops = get().stops;
      const created = await api.routes.create({
        route_date: today,
        stops: localStops.map((s) => ({
          address: s.address,
          lat: s.lat,
          lng: s.lng,
          color_code: s.colorCode,
          is_pinned: Boolean(s.isPinned),
          clients: s.clients.map((c) => ({
            name: c.name || 'Cliente',
            phone: c.phone || undefined,
            packages_count: c.packages || 1,
            notes: c.notes || undefined,
          })),
        })),
      });

      const detailByAddr = new Map(
        localStops.map((local) => [local.address.trim().toLowerCase(), local.detail])
      );
      set({
        routeId: created.id,
        stops: (created.stops ?? []).map((s) =>
          mapApiStopToStore(s, detailByAddr.get(s.address.trim().toLowerCase()) ?? '')
        ),
      });
      return created.id;
    } catch {
      return null;
    }
  },
}));

/** Case-insensitive lookup of a stop by its address. */
export const findStopByAddress = (stops: Stop[], address: string) =>
  stops.find((s) => s.address.trim().toLowerCase() === address.trim().toLowerCase());
