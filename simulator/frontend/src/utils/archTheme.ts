import { ArchitectureId } from '../types/simulator';

export const ARCH_COLORS: Record<ArchitectureId, string> = {
  MONO_MVP: '#2563EB',
  MONO_ASYNC_CONTAINER: '#D97706',
  MICRO_DOCKER: '#059669',
  HYBRID_EDGE_SERVERLESS: '#7C3AED',
};

export const ARCH_BG_TINTS: Record<ArchitectureId, string> = {
  MONO_MVP: '#EFF6FF',
  MONO_ASYNC_CONTAINER: '#FFFBEB',
  MICRO_DOCKER: '#ECFDF5',
  HYBRID_EDGE_SERVERLESS: '#F5F3FF',
};
