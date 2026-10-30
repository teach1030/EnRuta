import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useRouteStore, isUuid, mapApiStopToStore } from '../store/useRouteStore';
import type { Stop, Client } from '../store/useRouteStore';
import { useAuthStore } from '../store/useAuthStore';
import { api, getAuthToken } from '../services/api';

const COLORS = [
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
];

export default function StopDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'StopDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'StopDetail'>>();

  const params = route.params as any;
  const isNew: boolean = params?.isNew === true;

  const addStop = useRouteStore(state => state.addStop);
  const updateStop = useRouteStore(state => state.updateStop);
  const removeStop = useRouteStore(state => state.removeStop);
  const ensureActiveRoute = useRouteStore(state => state.ensureActiveRoute);
  const defaultNavigator = useAuthStore(state => state.defaultNavigator);

  const handleNavigateToStop = async () => {
    const lat = stop.lat;
    const lng = stop.lng;
    if (lat === undefined || lng === undefined || lat === null || lng === null) {
      Alert.alert(
        'Sin coordenadas GPS',
        'Esta parada no cuenta con coordenadas válidas para navegación satelital.'
      );
      return;
    }

    // Formato estricto para Waze: waze://?ll={lat},{lng}&navigate=yes
    const wazeUrl = `waze://?ll=${lat},${lng}&navigate=yes`;
    const googleMapsUrl = `google.navigation:q=${lat},${lng}`;
    const webFallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    const primaryUrl = defaultNavigator === 'waze' ? wazeUrl : googleMapsUrl;
    const secondaryUrl = defaultNavigator === 'waze' ? googleMapsUrl : wazeUrl;

    try {
      const canOpen = await Linking.canOpenURL(primaryUrl);
      if (canOpen) {
        await Linking.openURL(primaryUrl);
        return;
      }
    } catch {}

    try {
      const canOpenSec = await Linking.canOpenURL(secondaryUrl);
      if (canOpenSec) {
        await Linking.openURL(secondaryUrl);
        return;
      }
    } catch {}

    try {
      await Linking.openURL(webFallbackUrl);
    } catch {
      Alert.alert('Error', 'No se pudo abrir ninguna aplicación de mapas en el dispositivo.');
    }
  };

  // Resolve the initial stop: either a tempStop (new) or an existing one from the store
  const resolveInitial = (): Stop => {
    if (isNew && params?.tempStop) return params.tempStop as Stop;
    const { stops } = useRouteStore.getState();
    const found = stops.find(s => s.id === params?.stopId);
    return found ?? stops[0];
  };

  const [stop, setStop] = useState<Stop>(resolveInitial);
  const [saving, setSaving] = useState(false);

  const handleColorChange = (color: string) => {
    setStop(prev => ({ ...prev, colorCode: color }));
  };

  const handlePackageChange = (clientId: string, delta: number) => {
    setStop(prev => ({
      ...prev,
      clients: prev.clients.map(c =>
        c.id === clientId ? { ...c, packages: Math.max(1, c.packages + delta) } : c
      )
    }));
  };

  const handleNameChange = (clientId: string, text: string) => {
    setStop(prev => ({
      ...prev,
      clients: prev.clients.map(c =>
        c.id === clientId ? { ...c, name: text } : c
      )
    }));
  };

  const handlePhoneChange = (clientId: string, text: string) => {
    setStop(prev => ({
      ...prev,
      clients: prev.clients.map(c =>
        c.id === clientId ? { ...c, phone: text } : c
      )
    }));
  };

  const handleNotesChange = (clientId: string, text: string) => {
    setStop(prev => ({
      ...prev,
      clients: prev.clients.map(c =>
        c.id === clientId ? { ...c, notes: text } : c
      )
    }));
  };

  const handleAddClient = () => {
    const newClient: Client = {
      id: `c${Date.now()}`,
      name: '',
      phone: '',
      packages: 1,
      notes: ''
    };
    setStop(prev => ({
      ...prev,
      clients: [...prev.clients, newClient]
    }));
  };

  const handleRemoveClient = (clientId: string) => {
    setStop(prev => ({
      ...prev,
      clients: prev.clients.filter(c => c.id !== clientId),
    }));
  };

  const handleCall = (phone: string) => {
    if (phone) Linking.openURL(`tel:${phone}`);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (isNew) {
        if (getAuthToken()) {
          const activeRouteId = await ensureActiveRoute();
          if (activeRouteId) {
            const created = await api.stops.create({
              route_id: activeRouteId,
              address: stop.address,
              lat: stop.lat,
              lng: stop.lng,
              color_code: stop.colorCode,
              clients: stop.clients.map(c => ({
                name: c.name.trim() || 'Cliente',
                phone: c.phone.trim() || undefined,
                packages_count: c.packages || 1,
                notes: c.notes.trim() || undefined,
              })),
            });
            addStop(mapApiStopToStore(created, stop.detail));
            navigation.goBack();
            return;
          }
        }
        const added = addStop({ ...stop });
        if (added) navigation.goBack();
      } else {
        const { id, ...changes } = stop;
        updateStop(id, changes);

        if (getAuthToken()) {
          let targetStopId = id;
          if (!isUuid(targetStopId)) {
            await ensureActiveRoute();
            const synced = useRouteStore
              .getState()
              .stops.find(s => s.address.trim().toLowerCase() === stop.address.trim().toLowerCase());
            if (synced && isUuid(synced.id)) {
              targetStopId = synced.id;
            }
          }

          if (isUuid(targetStopId)) {
            const updated = await api.stops.update(targetStopId, {
              address: stop.address,
              lat: stop.lat,
              lng: stop.lng,
              color_code: stop.colorCode,
              status: stop.status,
              is_pinned: stop.isPinned,
              clients: stop.clients.map(c => ({
                id: isUuid(c.id) ? c.id : undefined,
                name: c.name.trim() || 'Cliente',
                phone: c.phone.trim() || undefined,
                packages_count: c.packages || 1,
                notes: c.notes.trim() || undefined,
              })),
            });
            updateStop(targetStopId, mapApiStopToStore(updated, stop.detail));
          }
        }

        navigation.goBack();
      }
    } catch (err: any) {
      Alert.alert('Error al guardar', err?.message || 'No se pudo sincronizar la parada con el servidor.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStop = () => {
    Alert.alert(
      'Eliminar Parada',
      '¿Estás seguro de que deseas eliminar esta parada de la ruta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (!isNew) {
              try {
                if (getAuthToken() && isUuid(stop.id)) {
                  await api.stops.delete(stop.id);
                }
              } catch (err: any) {
                Alert.alert('Error al eliminar', err?.message || 'No se pudo eliminar la parada del servidor.');
                return;
              }
              removeStop(stop.id);
            }
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isNew ? 'Nueva Parada' : 'Editar Parada'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <Text style={styles.doneBtn}>{isNew ? 'Guardar' : 'Listo'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.addressBlock}>
          <Text style={styles.addressText}>{stop.address}</Text>
          <Text style={styles.detailText}>{stop.detail || 'Sin detalle de ubicación'}</Text>
        </View>

        {/* Boton grande para Navegar a esta parada */}
        <TouchableOpacity
          style={styles.navigateBtn}
          onPress={handleNavigateToStop}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Navegar a esta parada"
        >
          <View style={styles.navigateBtnIcon}>
            <Ionicons name="navigate" size={22} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.navigateBtnText}>Navegar a esta parada</Text>
            <Text style={styles.navigateBtnSubtext}>
              Iniciar guía GPS ({defaultNavigator === 'waze' ? 'Waze' : 'Google Maps'})
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorSelector}>
          {COLORS.map(color => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorCircle,
                { backgroundColor: color },
                stop.colorCode === color && styles.colorCircleSelected
              ]}
              onPress={() => handleColorChange(color)}
            >
              {stop.colorCode === color && <View style={styles.colorDot} />}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Clientes en esta parada ({stop.clients.length})</Text>

        {stop.clients.map((client) => (
          <View key={client.id} style={styles.clientCard}>
            <View style={styles.clientHeader}>
              <View style={styles.clientInputsWrapper}>
                <TextInput
                  style={styles.clientNameInput}
                  value={client.name}
                  onChangeText={(text) => handleNameChange(client.id, text)}
                  placeholder="Nuevo Cliente"
                  placeholderTextColor="#94A3B8"
                />
                <TextInput
                  style={styles.clientPhoneInput}
                  value={client.phone}
                  onChangeText={(text) => handlePhoneChange(client.id, text)}
                  placeholder="Sin número"
                  placeholderTextColor="#94A3B8"
                  keyboardType="phone-pad"
                />
              </View>
              <View style={styles.clientActions}>
                <TouchableOpacity style={styles.callBtn} onPress={() => handleCall(client.phone)}>
                  <Ionicons name="call" size={18} color="#10B981" />
                  <Text style={styles.callBtnText}>Llamar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeClientBtn}
                  onPress={() => handleRemoveClient(client.id)}
                  accessibilityRole="button"
                  accessibilityLabel="Eliminar cliente"
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.stepperRow}>
              <Text style={styles.stepperLabel}>Paquetes:</Text>
              <View style={styles.stepperControls}>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => handlePackageChange(client.id, -1)}>
                  <Ionicons name="remove" size={20} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.stepperValue}>{client.packages}</Text>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => handlePackageChange(client.id, 1)}>
                  <Ionicons name="add" size={20} color="#0F172A" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.notesContainer}>
              <Text style={styles.notesLabel}>Notas:</Text>
              <TextInput
                style={styles.notesInput}
                value={client.notes}
                onChangeText={(text) => handleNotesChange(client.id, text)}
                placeholder="Añadir notas (ej: Dejar en portería)"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.addClientBtn} onPress={handleAddClient}>
          <Ionicons name="person-add-outline" size={20} color="#3B82F6" style={{ marginRight: 8 }} />
          <Text style={styles.addClientText}>Agregar Cliente a esta parada</Text>
        </TouchableOpacity>

        {isNew && (
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.saveBtnText}>{saving ? 'Guardando...' : 'Guardar Parada'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteStop} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.deleteBtnText}>Eliminar Parada</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0F172A',
  },
  doneBtn: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3B82F6',
  },
  content: {
    flex: 1,
  },
  addressBlock: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  addressText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 15,
    color: '#64748B',
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  navigateBtnIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  navigateBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  navigateBtnSubtext: {
    color: 'rgba(255, 255, 255, 0.88)',
    fontSize: 12,
    marginTop: 2,
  },
  colorSelector: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: '#E2E8F0',
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  clientCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  clientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  clientInputsWrapper: {
    flex: 1,
    marginRight: 12,
    gap: 6,
  },
  clientNameInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clientPhoneInput: {
    fontSize: 14,
    color: '#334155',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  callBtnText: {
    color: '#10B981',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
  clientActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  removeClientBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stepperLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  stepperBtn: {
    padding: 8,
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    width: 30,
    textAlign: 'center',
  },
  notesContainer: {
    marginTop: 4,
  },
  notesLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#0F172A',
  },
  addClientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderStyle: 'dashed',
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
  },
  addClientText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3B82F6',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#065F46',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    marginHorizontal: 16,
    marginTop: 14,
    padding: 16,
    borderRadius: 12,
  },
  deleteBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
