import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore, NavigatorOption } from '../store/useAuthStore';

const NAVIGATOR_OPTIONS: Array<{
  id: NavigatorOption;
  label: string;
  description: string;
  icon: 'map-outline' | 'compass-outline';
}> = [
  {
    id: 'maps',
    label: 'Google Maps',
    description: 'Navegación paso a paso con Google Maps',
    icon: 'map-outline',
  },
  {
    id: 'waze',
    label: 'Waze',
    description: 'Alertas de tráfico en tiempo real con Waze',
    icon: 'compass-outline',
  },
];

export default function SettingsScreen() {
  const navigation = useNavigation();
  const defaultNavigator = useAuthStore(state => state.defaultNavigator);
  const setDefaultNavigator = useAuthStore(state => state.setDefaultNavigator);
  const isGuest = useAuthStore(state => state.isGuest);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.sectionTitle}>Navegador Predeterminado</Text>
        <Text style={styles.sectionSubtitle}>
          Elige la aplicación que se abrirá al presionar "Ir a la siguiente parada".
        </Text>

        <View style={styles.optionsContainer}>
          {NAVIGATOR_OPTIONS.map(option => {
            const selected = defaultNavigator === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.optionCard, selected && styles.optionCardSelected]}
                onPress={() => setDefaultNavigator(option.id)}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
              >
                <View style={[styles.iconBox, selected && styles.iconBoxSelected]}>
                  <Ionicons
                    name={option.icon}
                    size={24}
                    color={selected ? '#FFFFFF' : '#065F46'}
                  />
                </View>

                <View style={styles.optionInfo}>
                  <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                    {option.label}
                  </Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>

                <Ionicons
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={selected ? '#10B981' : '#CBD5E1'}
                />
              </TouchableOpacity>
            );
          })}
        </View>

        {isGuest && (
          <View style={styles.guestNotice}>
            <MaterialCommunityIcons name="account-alert-outline" size={22} color="#065F46" />
            <Text style={styles.guestNoticeText}>
              Estás en modo invitado (límite de 10 paradas por ruta).
            </Text>
          </View>
        )}
      </View>
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
  body: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  optionCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#ECFDF5',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconBoxSelected: {
    backgroundColor: '#065F46',
  },
  optionInfo: {
    flex: 1,
    paddingRight: 8,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: '#065F46',
  },
  optionDescription: {
    fontSize: 12,
    color: '#64748B',
  },
  guestNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
    gap: 10,
  },
  guestNoticeText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#065F46',
  },
});
