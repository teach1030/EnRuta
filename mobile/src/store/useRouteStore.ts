import { create } from 'zustand';
import { Alert } from 'react-native';
import { useAuthStore } from './useAuthStore';

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
  clients: Client[];
};

// ─── Seed data (mock until the backend is connected) ──────────────────────────

export const INITIAL_STOPS: Stop[] = [
  {
    id: '1',
    address: 'Calle 166 #9-24',
    detail: 'Villa de Aranjuez, Usaquén',
    lat: 4.743,
    lng: -74.025,
    status: 'pending',
    colorCode: '#3B82F6',
    clients: [{ id: 'c1', name: 'Juan Perez', phone: '3001234567', packages: 1, notes: 'Dejar en porteria' }],
  },
  {
    id: '2',
    address: 'Cra. 12 #140-30',
    detail: 'Covivenda Telecom, Usaquén',
    lat: 4.721,
    lng: -74.032,
    status: 'pending',
    colorCode: '#3B82F6',
    clients: [{ id: 'c2', name: 'Maria Gomez', phone: '3119876543', packages: 2, notes: '' }],
  },
  {
    id: '3',
    address: 'Cl. 152 #50-54',
    detail: 'Mazuren, Suba',
    lat: 4.735,
    lng: -74.055,
    status: 'pending',
    colorCode: '#3B82F6',
    clients: [{ id: 'c3', name: 'Carlos Diaz', phone: '3205556677', packages: 1, notes: 'Llamar al llegar' }],
  },
];

// ─── Store ────────────────────────────────────────────────────────────────────

export const GUEST_MAX_STOPS = 10;

type RouteState = {
  stops: Stop[];
  isOptimized: boolean;
  addStop: (stop: Stop) => boolean;
  updateStop: (id: string, changes: Partial<Omit<Stop, 'id'>>) => void;
  removeStop: (id: string) => void;
  updateStopStatus: (id: string, status: StopStatus) => void;
  optimizeRoute: () => void;
};

export const useRouteStore = create<RouteState>((set, get) => ({
  stops: INITIAL_STOPS,
  isOptimized: false,

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

    set((state) => ({ stops: [...state.stops, stop], isOptimized: false }));
    return true;
  },

  updateStop: (id, changes) =>
    set((state) => ({
      stops: state.stops.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    })),

  removeStop: (id) =>
    set((state) => ({ stops: state.stops.filter((s) => s.id !== id) })),

  updateStopStatus: (id, status) =>
    set((state) => ({
      stops: state.stops.map((s) => (s.id === id ? { ...s, status } : s)),
    })),

  optimizeRoute: () =>
    set((state) => ({
      stops: [...state.stops],
      isOptimized: true,
    })),
}));

/** Case-insensitive lookup of a stop by its address. */
export const findStopByAddress = (stops: Stop[], address: string) =>
  stops.find((s) => s.address.trim().toLowerCase() === address.trim().toLowerCase());
