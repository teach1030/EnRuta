import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LogBox, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useRouteStore, findStopByAddress } from '../store/useRouteStore';
import type { Stop } from '../store/useRouteStore';

LogBox.ignoreLogs(['google places autocomplete']);

export default function SearchAddressScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const stops = useRouteStore(state => state.stops);

  const handleAddressSelected = (address: string, detail: string, lat: number, lng: number) => {
    const existingStop = findStopByAddress(stops, address);

    if (existingStop) {
      Alert.alert(
        'Dirección ya registrada',
        '¿Agregar este paquete a un nuevo cliente en esta parada?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Aceptar',
            onPress: () => navigation.replace('StopDetail', { stopId: existingStop.id }),
          },
        ]
      );
      return;
    }

    const newStop: Stop = {
      id: `s${Date.now()}`,
      address,
      detail,
      lat,
      lng,
      status: 'pending',
      colorCode: '#3B82F6',
      clients: [],
    };
    navigation.replace('StopDetail', { tempStop: newStop, isNew: true });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Buscar Dirección</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchContainer}>
        <GooglePlacesAutocomplete
          placeholder="Escribe una dirección..."
          fetchDetails={true}
          onPress={(data, details = null) => {
            const lat = details?.geometry?.location?.lat ?? 4.6097;
            const lng = details?.geometry?.location?.lng ?? -74.0817;
            const address = data.structured_formatting?.main_text ?? data.description;
            const detail = data.structured_formatting?.secondary_text ?? '';

            handleAddressSelected(address, detail, lat, lng);
          }}
          query={{
            key: 'AIzaSyCaAWhdnAmKerDuhXIQLvh5NYsYIkUcAGc',
            language: 'es',
            components: 'country:co',
          }}
          styles={{
            container: {
              flex: 1,
            },
            textInputContainer: {
              backgroundColor: '#F1F5F9',
              borderRadius: 12,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderTopWidth: 0,
              borderBottomWidth: 0,
            },
            textInput: {
              height: 44,
              color: '#0F172A',
              fontSize: 16,
              backgroundColor: 'transparent',
            },
            predefinedPlacesDescription: {
              color: '#64748B',
            },
            row: {
              padding: 14,
              backgroundColor: '#FFFFFF',
              borderBottomWidth: 1,
              borderBottomColor: '#E2E8F0',
            },
            description: {
              fontSize: 15,
              color: '#0F172A',
            },
          }}
          enablePoweredByContainer={false}
          debounce={300}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  searchContainer: {
    flex: 1,
    padding: 16,
  },
});
