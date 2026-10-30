import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initAuthToken } from '../services/api';

export type NavigatorOption = 'maps' | 'waze';

export type AuthUser = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  vehicle?: string;
  vehicle_plate?: string;
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isHydrated: boolean;
  defaultNavigator: NavigatorOption;
  login: (userData?: Partial<AuthUser>) => void;
  updateUser: (fields: Partial<AuthUser>) => void;
  loginAsGuest: () => void;
  logout: () => void;
  setDefaultNavigator: (nav: NavigatorOption) => void;
  setHydrated: (hydrated: boolean) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isGuest: false,
      isHydrated: false,
      defaultNavigator: 'maps',

      login: (userData) =>
        set({
          isAuthenticated: true,
          isGuest: false,
          user: {
            id: userData?.id ?? `u_${Date.now()}`,
            name: userData?.name ?? 'Conductor EnRuta',
            email: userData?.email ?? '',
            phone: userData?.phone ?? '',
            vehicle: userData?.vehicle ?? userData?.vehicle_plate ?? 'Vehiculo de Reparto',
            vehicle_plate: userData?.vehicle_plate ?? userData?.vehicle ?? '',
          },
        }),

      updateUser: (fields) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...fields } : null,
        })),

      loginAsGuest: () =>
        set({
          isAuthenticated: true,
          isGuest: true,
          user: {
            id: 'guest',
            name: 'Usuario Invitado',
            phone: 'Sin celular',
            vehicle: 'Modo prueba (max. 10 paradas)',
            vehicle_plate: 'TEST-000',
          },
        }),

      logout: () => {
        AsyncStorage.removeItem('enruta_jwt_token').catch(() => {});
        set({
          isAuthenticated: false,
          isGuest: false,
          user: null,
        });
      },

      setDefaultNavigator: (nav) => set({ defaultNavigator: nav }),

      setHydrated: (hydrated) => set({ isHydrated: hydrated }),
    }),
    {
      name: 'enruta-auth-session',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        initAuthToken()
          .catch(() => {})
          .finally(() => {
            state?.setHydrated(true);
          });
      },
    }
  )
);
