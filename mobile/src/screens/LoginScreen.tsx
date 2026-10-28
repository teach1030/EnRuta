import React from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/useAuthStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AuthButtonProps {
  onPress: () => void;
  icon: React.ReactNode;
  label: string;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/**
 * Reusable white card button used for every OAuth / email option.
 * The icon is left-pinned; the label is visually centred via a
 * compensating right-margin equal to the icon slot width.
 */
const AuthButton: React.FC<AuthButtonProps> = ({ onPress, icon, label }) => (
  <TouchableOpacity
    style={styles.authButton}
    onPress={onPress}
    activeOpacity={0.85}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <View style={styles.authButtonIcon}>{icon}</View>
    <Text style={styles.authButtonLabel}>{label}</Text>
  </TouchableOpacity>
);

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'Login'>>();
  const [isSubmittingEmail, setIsSubmittingEmail] = React.useState(false);
  const login = useAuthStore(state => state.login);
  const loginAsGuest = useAuthStore(state => state.loginAsGuest);

  const handleGoogleSignIn = () => {
    // TODO: integrate expo-auth-session / Google OAuth, then navigate
    login({
      name: 'Juan Esteban Guerrero',
      email: 'juan@enruta.co',
      vehicle: 'Suzuki GSX-S 150',
    });
    navigation.replace('HomeMap');
  };

  /**
   * Estructura preparada para conectar la autenticación por Email con el backend.
   * Recibirá credenciales (email, password), validará el formato, consumirá el endpoint
   * POST /auth/login, almacenará el JWT y redirigirá al mapa principal.
   */
  const handleEmailSignIn = async (credentials?: { email: string; password: string }) => {
    if (isSubmittingEmail) return;
    try {
      setIsSubmittingEmail(true);
      // TODO: Conectar con el servicio de backend (ej: await api.auth.loginWithEmail(credentials))
      const payload = {
        email: credentials?.email?.trim().toLowerCase() ?? '',
        password: credentials?.password ?? '',
      };

      login({
        name: 'Juan Esteban Guerrero',
        email: payload.email || 'juan@enruta.co',
        vehicle: 'Suzuki GSX-S 150',
      });
      navigation.replace('HomeMap');
    } catch (error) {
      console.error('Error al iniciar sesión con email:', error);
    } finally {
      setIsSubmittingEmail(false);
    }
  };

  const handleGuestMode = () => {
    loginAsGuest();
    navigation.replace('HomeMap');
  };

  return (
    <ImageBackground
      source={require('../../assets/bogota-bg.jpg')}
      style={styles.background}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* ── Dark overlay – ensures text readability over any photo ─────── */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      <SafeAreaView style={styles.safeArea}>

        {/* ── Brand header ─────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.brandName}>EnRuta</Text>
          <Text style={styles.headline}>
            Planificador multiparada{'\n'}para repartidores
          </Text>
        </View>

        {/* ── Flexible gap – pushes auth section to the lower half ──────── */}
        <View style={styles.spacer} />

        {/* ── Authentication options ───────────────────────────────────── */}
        <View style={styles.authContainer}>

          {/* Google */}
          <AuthButton
            onPress={handleGoogleSignIn}
            icon={<FontAwesome5 name="google" size={22} color="#1E293B" />}
            label="Continuar con Google"
          />

          {/* Email */}
          <AuthButton
            onPress={() => handleEmailSignIn()}
            icon={
              <MaterialCommunityIcons
                name="email-outline"
                size={22}
                color="#1E293B"
              />
            }
            label="Continuar con Email"
          />

          {/* ── Guest mode ─────────────────────────────────────────────── */}
          <TouchableOpacity
            style={styles.guestButton}
            onPress={handleGuestMode}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Entrar como invitado"
          >
            <Text style={styles.guestLabel}>Entrar como invitado</Text>
          </TouchableOpacity>

        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const { height } = Dimensions.get('window');

const styles = StyleSheet.create({

  // ── Root layout ───────────────────────────────────────────────────────────
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  /** rgba(15, 23, 42, 0.6) = Slate-950 at 60 % opacity */
  overlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 24,
  },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    marginTop: height * 0.08,
    alignItems: 'center',
  },
  /** Emerald brand mark – #10B981 */
  brandName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  headline: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 44,
  },

  // ── Spacer ────────────────────────────────────────────────────────────────
  spacer: {
    flex: 1,
  },

  // ── Auth section ──────────────────────────────────────────────────────────
  authContainer: {
    paddingBottom: 32,
    gap: 12,
  },

  // ── White card button ─────────────────────────────────────────────────────
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 55,
    paddingHorizontal: 20,
    // Cross-platform shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  /** Fixed-width slot so all icons are left-aligned consistently */
  authButtonIcon: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Compensating marginRight equals icon slot → label appears centred */
  authButtonLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginRight: 28,
  },

  // ── Ghost / guest button ──────────────────────────────────────────────────
  guestButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  guestLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#E2E8F0',
    textDecorationLine: 'underline',
  },
});
