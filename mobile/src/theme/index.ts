export const Colors = {
  primary:       '#065F46', // Verde Bosque Oscuro
  primaryLight:  '#E6F4EA', // Verde muy claro / fondo pill
  accent:        '#10B981', // Verde Esmeralda Vivo
  background:    '#F1F5F9', // Gris muy suave
  surface:       '#FFFFFF', // Blanco puro
  surfaceAlt:    '#F8FAFC', // Blanco alternativo suave
  textPrimary:   '#0F172A',
  textSecondary: '#64748B',
  textMuted:     '#94A3B8',
  textOnDark:    '#FFFFFF',
  border:        '#E2E8F0',
  error:         '#EF4444',
  success:       '#10B981',
} as const;

export const Typography = {
  size: { xs: 14, sm: 16, md: 18, lg: 22, xl: 28, xxl: 34 },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
} as const;

export const Spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const Radius = { sm: 8, md: 16, lg: 24, xl: 32, full: 999 } as const;
export const TouchTarget = { md: 56, lg: 64, xl: 80 } as const;
export const Shadows = {
  sm: { shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  md: { shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  lg: { shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 },
  soft: { shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
} as const;
