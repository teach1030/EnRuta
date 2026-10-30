import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import HomeMapScreen from '../screens/HomeMapScreen';
import ScannerScreen from '../screens/ScannerScreen';
import StopsListScreen from '../screens/StopsListScreen';

import StopDetailScreen from '../screens/StopDetailScreen';
import SearchAddressScreen from '../screens/SearchAddressScreen';
import RouteHistoryScreen from '../screens/RouteHistoryScreen';
import RouteDetailScreen from '../screens/RouteDetailScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useAuthStore } from '../store/useAuthStore';

export type SelectedAddress = {
  address: string;
  detail: string;
  lat: number;
  lng: number;
};

export type RootStackParamList = {
  Login: undefined;
  HomeMap: { selectedAddress?: SelectedAddress } | undefined;
  Scanner: undefined;
  StopsList: undefined;
  StopDetail: { stopId: string; isNew?: boolean } | { tempStop: import('../screens/HomeMapScreen').Stop; isNew: true };
  SearchAddress: undefined;
  RouteHistory: undefined;
  RouteDetail: { routeId: string | number; routeTitle?: string };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const isHydrated = useAuthStore(state => state.isHydrated);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  if (!isHydrated) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={isAuthenticated ? 'HomeMap' : 'Login'}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F1F5F9' } }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="HomeMap" component={HomeMapScreen} />
      <Stack.Screen name="Scanner" component={ScannerScreen} options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="StopsList" component={StopsListScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="StopDetail" component={StopDetailScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="SearchAddress" component={SearchAddressScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="RouteHistory" component={RouteHistoryScreen} />
      <Stack.Screen name="RouteDetail" component={RouteDetailScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
  },
});