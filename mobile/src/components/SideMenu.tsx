import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  TouchableOpacity,
  Animated,
  Dimensions,
  Image,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/useAuthStore';

const { width: SCREEN_W } = Dimensions.get('window');
const MENU_WIDTH = SCREEN_W * 0.75;

const MENU_ITEMS: Array<{
  id: string;
  label: string;
  icon: 'time-outline' | 'settings-outline';
  route: 'RouteHistory' | 'Settings';
}> = [
  { id: 'history', label: 'Historial de Rutas', icon: 'time-outline', route: 'RouteHistory' },
  { id: 'settings', label: 'Configuración', icon: 'settings-outline', route: 'Settings' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SideMenu({ visible, onClose }: Props) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  const translateX = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  const handleMenuNavigate = (route: 'RouteHistory' | 'Settings') => {
    onClose();
    navigation.navigate(route);
  };

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Aceptar',
          style: 'destructive',
          onPress: () => {
            logout();
            onClose();
            navigation.navigate('Login');
          },
        },
      ]
    );
  };

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 20,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: -MENU_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[styles.panel, { transform: [{ translateX }] }]}
        >
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
            <View style={styles.profileHeader}>
              <Image
                source={{ uri: 'https://ui-avatars.com/api/?name=Juan+Esteban&background=10B981&color=fff&size=128' }}
                style={styles.avatar}
              />
              <Text style={styles.profileName}>{user?.name ?? 'Juan Esteban Guerrero'}</Text>
              <View style={styles.vehicleRow}>
                <Ionicons name="bicycle-outline" size={14} color="#A7F3D0" style={{ marginRight: 4 }} />
                <Text style={styles.vehicleText}>{user?.vehicle ?? 'Suzuki GSX-S 150'}</Text>
              </View>
            </View>

            <View style={styles.menuItems}>
              {MENU_ITEMS.map(item => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.menuRow}
                  onPress={() => handleMenuNavigate(item.route)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={item.icon} size={22} color="#334155" style={styles.menuIcon} />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.menuRow}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={22} color="#EF4444" style={styles.menuIcon} />
              <Text style={[styles.menuLabel, { color: '#EF4444' }]}>Cerrar Sesión</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: MENU_WIDTH,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 16,
  },
  profileHeader: {
    backgroundColor: '#065F46',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 28,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: '#A7F3D0',
    marginBottom: 12,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehicleText: {
    fontSize: 13,
    color: '#A7F3D0',
  },
  menuItems: {
    paddingTop: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  menuIcon: {
    marginRight: 14,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#334155',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8,
    marginHorizontal: 20,
  },
});
