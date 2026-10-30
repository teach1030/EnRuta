import React, { useState } from 'react';
import {
  View,
  Text,
  ImageBackground,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Dimensions,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5, Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../services/api';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Login'>>();
  const login = useAuthStore(state => state.login);
  const loginAsGuest = useAuthStore(state => state.loginAsGuest);

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim();
    if (isRegisterMode) {
      const trimmedName = name.trim();
      if (!trimmedName || !trimmedEmail || !password) {
        Alert.alert('Campos requeridos', 'Por favor ingresa tu nombre completo, correo y contraseña.');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Contraseña corta', 'La contraseña debe tener al menos 6 caracteres.');
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await api.auth.register({
          name: trimmedName,
          email: trimmedEmail.toLowerCase(),
          password,
        });

        login({
          id: response.driver.id,
          name: response.driver.name,
          email: response.driver.email ?? trimmedEmail.toLowerCase(),
          phone: response.driver.phone,
          vehicle: response.driver.vehicle ?? 'Vehículo asignado',
          vehicle_plate: response.driver.vehicle_plate ?? '',
        });

        navigation.replace('HomeMap');
      } catch (error: any) {
        Alert.alert(
          'Error de Registro',
          error?.message || 'No fue posible crear la cuenta. Intenta de nuevo.'
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Modo Inicio de Sesión
    if (!trimmedEmail || !password) {
      Alert.alert('Campos requeridos', 'Por favor ingresa tu correo electrónico y tu contraseña.');
      return;
    }

    setIsSubmitting(true);
    try {
      const isPhone = /^\d{10}$/.test(trimmedEmail);
      const credentials = isPhone
        ? { phone: trimmedEmail, password }
        : { email: trimmedEmail.toLowerCase(), password };

      const response = await api.auth.login(credentials);

      login({
        id: response.driver.id,
        name: response.driver.name,
        email: response.driver.email ?? (isPhone ? undefined : trimmedEmail.toLowerCase()),
        phone: response.driver.phone,
        vehicle: response.driver.vehicle ?? response.driver.vehicle_plate ?? 'Vehículo asignado',
        vehicle_plate: response.driver.vehicle_plate ?? '',
      });

      navigation.replace('HomeMap');
    } catch (error: any) {
      Alert.alert(
        'Error de Autenticación',
        error?.message || 'No fue posible iniciar sesión. Verifica tus credenciales y conexión.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = () => {
    Alert.alert(
      'Google Sign-In',
      'Para esta prueba local utiliza el inicio de sesión con Email o entra como Invitado.',
      [{ text: 'Entendido' }]
    );
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
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Brand Header ─────────────────────────────────────────── */}
            <View style={styles.header}>
              <Text style={styles.brandName}>EnRuta</Text>
              <Text style={styles.headline}>
                Planificador multiparada{'\n'}para repartidores
              </Text>
            </View>

            {/* ── Form Container ────────────────────────────────────────── */}
            <View style={styles.authContainer}>
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>
                  {isRegisterMode ? 'Crear Cuenta' : 'Iniciar Sesión'}
                </Text>

                {/* Nombre (solo en registro) */}
                {isRegisterMode && (
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color="#64748B" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Nombre completo"
                      placeholderTextColor="#94A3B8"
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                      editable={!isSubmitting}
                    />
                  </View>
                )}

                {/* Email / Celular input */}
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={isRegisterMode ? 'Correo electrónico' : 'Correo o celular (10 dígitos)'}
                    placeholderTextColor="#94A3B8"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    editable={!isSubmitting}
                  />
                </View>

                {/* Password input */}
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#64748B" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Contraseña (mínimo 6 caracteres)"
                    placeholderTextColor="#94A3B8"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isSubmitting}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(prev => !prev)}
                    style={styles.eyeBtn}
                    accessibilityLabel="Mostrar u ocultar contraseña"
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#64748B"
                    />
                  </TouchableOpacity>
                </View>

                {/* Submit button */}
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {isRegisterMode ? 'Registrarme en EnRuta' : 'Entrar a EnRuta'}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Switch Login / Register */}
                <TouchableOpacity
                  style={styles.switchModeButton}
                  onPress={() => setIsRegisterMode(prev => !prev)}
                  disabled={isSubmitting}
                  activeOpacity={0.7}
                >
                  <Text style={styles.switchModeText}>
                    {isRegisterMode ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* ── Divider ────────────────────────────────────────────── */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>o también</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* ── Google Button ──────────────────────────────────────── */}
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Continuar con Google"
              >
                <View style={styles.googleIconSlot}>
                  <FontAwesome5 name="google" size={18} color="#EA4335" />
                </View>
                <Text style={styles.googleButtonText}>Continuar con Google</Text>
              </TouchableOpacity>

              {/* ── Guest Mode ─────────────────────────────────────────── */}
              <TouchableOpacity
                style={styles.guestButton}
                onPress={handleGuestMode}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Entrar como invitado"
              >
                <Text style={styles.guestLabel}>Entrar como invitado (10 paradas)</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'android' ? 120 : 60,
  },
  header: {
    marginTop: height * 0.04,
    marginBottom: 16,
    alignItems: 'center',
  },
  brandName: {
    fontSize: 38,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  headline: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 28,
  },
  authContainer: {
    gap: 12,
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
    marginBottom: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
  },
  eyeBtn: {
    padding: 6,
  },
  primaryButton: {
    backgroundColor: '#065F46',
    borderRadius: 12,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  switchModeButton: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 6,
  },
  switchModeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#065F46',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  dividerText: {
    color: '#E2E8F0',
    fontSize: 13,
    paddingHorizontal: 10,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  googleIconSlot: {
    width: 28,
    alignItems: 'center',
  },
  googleButtonText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
    marginRight: 28,
  },
  guestButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  guestLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#E2E8F0',
    textDecorationLine: 'underline',
  },
});
