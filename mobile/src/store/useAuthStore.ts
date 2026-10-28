import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NavigatorOption = 'maps' | 'waze';

export type AuthUser = {
  id: string;
  name: string;
  email?: string;
  vehicle?: string;
};

type AuthState = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isHydrated: boolean;
  defaultNavigator: NavigatorOption;
  login: (userData?: Partial<AuthUser>) => void;
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
            name: userData?.name ?? 'Juan Esteban Guerrero',
            email: userData?.email ?? 'juan@enruta.co',
            vehicle: userData?.vehicle ?? 'Suzuki GSX-S 150',
          },
        }),

      loginAsGuest: () =>
        set({
          isAuthenticated: true,
          isGuest: true,
          user: {
            id: 'guest',
            name: 'Usuario Invitado',
            vehicle: 'Modo prueba (máx. 10 paradas)',
          },
        }),

      logout: () =>
        set({
          user: null,
          isAuthenticated: false,
          isGuest: false,
        }),

      setDefaultNavigator: (nav) => set({ defaultNavigator: nav }),

      setHydrated: (hydrated) => set({ isHydrated: hydrated }),
    }),
    {
      name: 'enruta-auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest,
        defaultNavigator: state.defaultNavigator,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);
