import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore, NavigatorOption } from '../store/useAuthStore';
import { api, getAuthToken } from '../services/api';

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
  const user = useAuthStore(state => state.user);
  const updateUser = useAuthStore(state => state.updateUser);
  const defaultNavigator = useAuthStore(state => state.defaultNavigator);
  const setDefaultNavigator = useAuthStore(state => state.setDefaultNavigator);
  const isGuest = useAuthStore(state => state.isGuest);

  const [vehicle, setVehicle] = useState(user?.vehicle ?? '');
  const [vehiclePlate, setVehiclePlate] = useState(user?.vehicle_plate ?? '');
  const [isSavingVehicle, setIsSavingVehicle] = useState(false);

  useEffect(() => {
    if (user) {
      setVehicle(user.vehicle ?? '');
      setVehiclePlate(user.vehicle_plate ?? '');
    }
  }, [user]);

  const handleSaveVehicle = async () => {
    const trimmedVehicle = vehicle.trim();
    const trimmedPlate = vehiclePlate.trim().toUpperCase();

    if (!trimmedVehicle && !trimmedPlate) {
      Alert.alert('Datos vacíos', 'Por favor ingresa al menos el tipo de vehículo o la placa.');
      return;
    }

    if (isGuest || !getAuthToken()) {
      updateUser({
        vehicle: trimmedVehicle || 'Vehículo de reparto',
        vehicle_plate: trimmedPlate || '',
      });
      Alert.alert('Actualizado', 'Datos de vehículo guardados en tu sesión.');
      return;
    }

    setIsSavingVehicle(true);
    try {
      const updated = await api.auth.updateProfile({
        vehicle: trimmedVehicle,
        vehicle_plate: trimmedPlate,
      });

      updateUser({
        vehicle: updated.vehicle ?? trimmedVehicle,
        vehicle_plate: updated.vehicle_plate ?? trimmedPlate,
      });

      Alert.alert('¡Guardado!', 'Los datos de tu vehículo se actualizaron correctamente.');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'No fue posible guardar los cambios en el servidor.');
    } finally {
      setIsSavingVehicle(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Configuración</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ── Vehículo del Conductor ──────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Vehículo y Placa</Text>
        <Text style={styles.sectionSubtitle}>
          Esta información se mostrará en tu perfil y menú lateral.
        </Text>

        <View style={styles.card}>
          <Text style={styles.inputLabel}>Tipo / Modelo de Vehículo</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="bicycle-outline" size={20} color="#065F46" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Ej: Moto Suzuki GN 125, Carro"
              placeholderTextColor="#94A3B8"
              value={vehicle}
              onChangeText={setVehicle}
              editable={!isSavingVehicle}
            />
          </View>

          <Text style={styles.inputLabel}>Placa</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="card-outline" size={20} color="#065F46" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Ej: ABC-123"
              placeholderTextColor="#94A3B8"
              value={vehiclePlate}
              onChangeText={setVehiclePlate}
              autoCapitalize="characters"
              editable={!isSavingVehicle}
            />
          </View>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSaveVehicle}
            disabled={isSavingVehicle}
            activeOpacity={0.85}
          >
            {isSavingVehicle ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Guardar Vehículo</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Navegador Predeterminado ────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Navegador Predeterminado</Text>
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

        <View style={{ height: 32 }} />
      </ScrollView>
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
  content: {
    flex: 1,
  },
  scrollContent: {
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
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  saveBtn: {
    backgroundColor: '#065F46',
    borderRadius: 10,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
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
