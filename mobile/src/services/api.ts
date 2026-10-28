/**
 * src/services/api.ts
 * Capa de comunicacion completa con el backend FastAPI de EnRuta.
 * Soporta autenticacion JWT, gestion de rutas, paradas multi-cliente y OCR con Gemini.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000/api/v1';
const AUTH_TOKEN_STORAGE_KEY = 'enruta_jwt_token';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type StopStatus = 'pending' | 'delivered' | 'failed';

export interface Client {
  id?: string;
  name: string;
  phone?: string;
  packages?: number;
  packages_count?: number;
  notes?: string;
}

export interface Stop {
  id: string;
  route_id?: string;
  address: string;
  detail?: string;
  lat: number;
  lng: number;
  status: StopStatus;
  color_code?: string;
  colorCode?: string;
  sequence_order?: number;
  clients: Client[];
}

export interface Route {
  id: string;
  route_date: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  total_stops: number;
  completed_stops: number;
  origin_lat: number | null;
  origin_lng: number | null;
  stops?: Stop[];
}

export interface OptimizeResult {
  route_id: string;
  message: string;
  total_stops: number;
  estimated_distance_km: number;
  estimated_duration_min: number;
  optimized_sequence: number[];
  stops: Stop[];
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  vehicle_plate?: string | null;
  is_active: boolean;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  driver: Driver;
}

export interface OCRGuideResult {
  raw_text: string;
  tracking_number: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  raw_address: string | null;
  normalized_address: string | null;
  complement: string | null;
  locality: string | null;
  lat: number | null;
  lng: number | null;
  package_weight_kg: number | null;
  confidence: number;
}

export type GeoPoint = { lat: number; lon: number };

// ─── Token JWT en memoria y persistencia ──────────────────────────────────────

let activeToken: string | null = null;

export async function initAuthToken(): Promise<string | null> {
  try {
    const saved = await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    activeToken = saved;
    return saved;
  } catch {
    return null;
  }
}

export async function setAuthToken(token: string | null): Promise<void> {
  activeToken = token;
  try {
    if (token) {
      await AsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {}
}

export function getAuthToken(): string | null {
  return activeToken;
}

// ─── Fetch Helper ─────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (activeToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = body?.detail ?? `Error HTTP ${res.status}`;
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }

  if (res.status === 204) {
    return null as unknown as T;
  }

  return res.json() as Promise<T>;
}

// ─── API Endpoints ────────────────────────────────────────────────────────────

export const api = {
  // --- Auth & Drivers ---
  auth: {
    login: async (creds: { email?: string; phone?: string; password: string }): Promise<AuthTokenResponse> => {
      const data = await apiFetch<AuthTokenResponse>('/drivers/login', {
        method: 'POST',
        body: JSON.stringify(creds),
      });
      await setAuthToken(data.access_token);
      return data;
    },

    googleAuth: async (idToken: string): Promise<AuthTokenResponse> => {
      const data = await apiFetch<AuthTokenResponse>('/drivers/google-auth', {
        method: 'POST',
        body: JSON.stringify({ id_token: idToken }),
      });
      await setAuthToken(data.access_token);
      return data;
    },

    register: (payload: { name: string; phone: string; email?: string; password: string; vehicle_plate?: string }) =>
      apiFetch<Driver>('/drivers/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getMe: () => apiFetch<Driver>('/drivers/me'),

    logout: async () => {
      await setAuthToken(null);
    },
  },

  // --- Routes ---
  routes: {
    create: (data: { route_date?: string; stops?: any[] }) =>
      apiFetch<Route>('/routes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    get: (id: string) => apiFetch<Route>(`/routes/${id}`),

    start: (id: string) =>
      apiFetch<Route>(`/routes/${id}/start`, { method: 'POST' }),

    optimize: (
      routeId: string,
      origin: GeoPoint | { address: string },
      opts?: { returnToDepot?: boolean; maxSeconds?: number },
    ): Promise<OptimizeResult> => {
      const p = new URLSearchParams();
      if ('lat' in origin) {
        p.set('start_lat', String(origin.lat));
        p.set('start_lon', String(origin.lon));
      } else {
        p.set('start_address', origin.address);
      }
      if (opts?.returnToDepot !== undefined) p.set('return_to_depot', String(opts.returnToDepot));
      if (opts?.maxSeconds !== undefined) p.set('max_seconds', String(opts.maxSeconds));
      return apiFetch<OptimizeResult>(`/routes/${routeId}/optimize?${p}`, { method: 'POST' });
    },
  },

  // --- Stops (Multi-Cliente CRUD) ---
  stops: {
    create: (payload: {
      route_id: string;
      address: string;
      lat?: number;
      lng?: number;
      color_code?: string;
      clients?: Array<{ name: string; phone?: string; packages_count?: number; notes?: string }>;
    }) =>
      apiFetch<Stop>('/stops', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    get: (stopId: string) => apiFetch<Stop>(`/stops/${stopId}`),

    update: (
      stopId: string,
      payload: {
        address?: string;
        lat?: number;
        lng?: number;
        color_code?: string;
        status?: StopStatus;
        clients?: Array<{ id?: string; name: string; phone?: string; packages_count?: number; notes?: string }>;
      },
    ) =>
      apiFetch<Stop>(`/stops/${stopId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    updateStatus: (stopId: string, status: StopStatus) =>
      apiFetch<Stop>(`/stops/${stopId}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),

    delete: (stopId: string) =>
      apiFetch<void>(`/stops/${stopId}`, {
        method: 'DELETE',
      }),
  },

  // --- OCR (Gemini Vision) ---
  ocr: {
    processGuide: async (photoUri: string, mimeType = 'image/jpeg'): Promise<OCRGuideResult> => {
      const formData = new FormData();
      const filename = photoUri.split('/').pop() || 'guide.jpg';

      formData.append('file', {
        uri: photoUri,
        type: mimeType,
        name: filename,
      } as any);

      const headers: Record<string, string> = {};
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      const res = await fetch(`${BASE_URL}/ocr/process-guide`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `Error OCR HTTP ${res.status}`);
      }

      return res.json() as Promise<OCRGuideResult>;
    },
  },
};

// Compatibilidad hacia atras con funciones sueltas
export const optimizeRoute = api.routes.optimize;
export const getRoute = api.routes.get;
export const startRoute = api.routes.start;
