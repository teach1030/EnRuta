/**
 * src/services/api.ts
 * Capa de comunicacion completa con el backend FastAPI de EnRuta.
 * Soporta autenticacion JWT, gestion de rutas, paradas multi-cliente y OCR con Gemini.
 */
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const RAW_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:8000/api/v1';
const BASE_URL = RAW_URL.endsWith('/api/v1') ? RAW_URL : `${RAW_URL.replace(/\/+$/, '')}/api/v1`;
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
  is_pinned?: boolean;
  isPinned?: boolean;
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
  optimization_metadata?: Record<string, any> | null;
  finished_at?: string | null;
  created_at?: string;
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
  vehicle?: string | null;
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
  if (!activeToken) {
    await initAuthToken();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (activeToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }

  const controller = new AbortController();
  const timeoutMs = 12000;
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    const isTimeout = err.name === 'AbortError' || msg.includes('canceled') || msg.includes('timeout');
    const isNetworkError = msg.includes('network') || msg.includes('failed');

    if (isTimeout || isNetworkError) {
      Alert.alert(
        'Sin conexión con el backend',
        `No fue posible comunicarse con el backend en:\n${BASE_URL}\n\nVerifica:\n1. Que el celular esté en la misma red Wi-Fi que el PC (desactiva datos móviles 4.5G).\n2. Que uvicorn esté ejecutándose en tu PC en el puerto 8000.`
      );
      throw new Error(`No se pudo conectar con ${BASE_URL}. Asegúrate de estar en la misma red Wi-Fi y no en datos móviles.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

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

    register: async (payload: {
      name: string;
      email?: string;
      phone?: string;
      password: string;
      vehicle?: string;
      vehicle_plate?: string;
    }): Promise<AuthTokenResponse> => {
      const data = await apiFetch<AuthTokenResponse>('/drivers/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      await setAuthToken(data.access_token);
      return data;
    },

    updateProfile: (payload: {
      name?: string;
      email?: string;
      phone?: string;
      vehicle?: string;
      vehicle_plate?: string;
    }): Promise<Driver> =>
      apiFetch<Driver>('/drivers/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    getMe: () => apiFetch<Driver>('/drivers/me'),

    logout: async () => {
      await setAuthToken(null);
    },
  },

  // --- Routes ---
  routes: {
    list: (status?: string) =>
      apiFetch<Route[]>(status ? `/routes?status=${encodeURIComponent(status)}` : '/routes'),

    getHistory: () =>
      apiFetch<Route[]>('/routes/history'),

    create: (data: { route_date?: string; origin_lat?: number; origin_lng?: number; stops?: any[] }) =>
      apiFetch<Route>('/routes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    get: (id: string) => apiFetch<Route>(`/routes/${id}`),

    start: (id: string) =>
      apiFetch<Route>(`/routes/${id}/start`, { method: 'POST' }),

    finish: async (id: string): Promise<Route> => {
      if (!id) {
        throw new Error('ID de ruta inválido para finalizar.');
      }
      return await apiFetch<Route>(`/routes/${encodeURIComponent(id)}/finish`, {
        method: 'POST',
      });
    },

    reorder: (routeId: string, stopIds: string[], pinnedStopIds?: string[]) =>
      apiFetch<Stop[]>(`/routes/${routeId}/reorder`, {
        method: 'PUT',
        body: JSON.stringify({
          stop_ids: stopIds,
          ...(pinnedStopIds ? { pinned_stop_ids: pinnedStopIds } : {}),
        }),
      }),

    optimize: (
      routeId: string,
      paramsOrOrigin:
        | {
            start_location?: { lat: number; lng: number };
            end_location?: { lat: number; lng: number };
            start_lat?: number;
            start_lon?: number;
            start_lng?: number;
            end_lat?: number;
            end_lon?: number;
            end_lng?: number;
            start_address?: string;
            end_address?: string;
            return_to_depot?: boolean;
            max_seconds?: number;
          }
        | GeoPoint
        | { address: string },
      opts?: { returnToDepot?: boolean; maxSeconds?: number },
    ): Promise<OptimizeResult> => {
      if (
        'start_location' in paramsOrOrigin ||
        'end_location' in paramsOrOrigin ||
        ('start_address' in paramsOrOrigin && !('lat' in paramsOrOrigin)) ||
        'end_address' in paramsOrOrigin
      ) {
        return apiFetch<OptimizeResult>(`/routes/${routeId}/optimize`, {
          method: 'POST',
          body: JSON.stringify(paramsOrOrigin),
        });
      }

      const p = new URLSearchParams();
      if ('lat' in paramsOrOrigin) {
        p.set('start_lat', String(paramsOrOrigin.lat));
        p.set('start_lon', String(paramsOrOrigin.lon));
      } else if ('address' in paramsOrOrigin) {
        p.set('start_address', paramsOrOrigin.address);
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
      is_pinned?: boolean;
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
        status?: StopStatus | 'PENDING' | 'DELIVERED' | 'FAILED';
        is_pinned?: boolean;
        clients?: Array<{ id?: string; name: string; phone?: string; packages_count?: number; notes?: string }>;
      },
    ) =>
      apiFetch<Stop>(`/stops/${stopId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),

    updateStatus: (stopId: string, status: StopStatus | 'PENDING' | 'DELIVERED' | 'FAILED') =>
      apiFetch<Stop>(`/stops/${stopId}/estado`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      }),

    delete: (stopId: string) =>
      apiFetch<void>(`/stops/${stopId}`, {
        method: 'DELETE',
      }),
  },

  // --- OCR (Gemini Vision con FileSystem.uploadAsync) ---
  ocr: {
    processGuide: async (
      photo: { uri: string; type?: string; name?: string } | string
    ): Promise<OCRGuideResult> => {
      const fileUri = typeof photo === 'string' ? photo : photo.uri;
      const uploadUrl = `${BASE_URL}/ocr/process-guide`;

      const headers: Record<string, string> = {};
      if (activeToken) {
        headers['Authorization'] = `Bearer ${activeToken}`;
      }

      let uploadResult: FileSystem.FileSystemUploadResult;
      try {
        uploadResult = await FileSystem.uploadAsync(uploadUrl, fileUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          headers,
        });
      } catch (uploadErr: any) {
        Alert.alert(
          'Error al conectar con servidor OCR',
          'No se pudo conectar con el servidor OCR. Verifica la conexión y que el backend esté activo.'
        );
        throw new Error(
          `No se pudo conectar con el servidor OCR: ${uploadErr?.message || 'Error de red'}`
        );
      }

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        let detail = `Error OCR HTTP ${uploadResult.status}`;
        try {
          const parsed = JSON.parse(uploadResult.body);
          detail = parsed.detail || detail;
        } catch {}
        Alert.alert('Error al procesar guía', detail);
        throw new Error(detail);
      }

      try {
        return JSON.parse(uploadResult.body) as OCRGuideResult;
      } catch {
        throw new Error('Respuesta no válida del servidor OCR.');
      }
    },
  },
};

// Compatibilidad hacia atras con funciones sueltas
export const optimizeRoute = api.routes.optimize;
export const getRoute = api.routes.get;
export const startRoute = api.routes.start;
