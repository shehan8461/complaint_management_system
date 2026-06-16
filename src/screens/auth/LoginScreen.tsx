// LoginScreen.tsx — Mobile login screen matching cat2020-cms-frontend login page
// Updated to match the new Complaint Management System design.

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Switch,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from '../../services/AuthService';

// ─── Constants ───────────────────────────────────────────────────────────────

const REMEMBERED_EMAIL_KEY = 'cms_login_email';
const REMEMBER_PREFERENCE_KEY = 'cms_login_remember';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Props {
  onLoginSuccess?: () => void;
}

interface FormErrors {
  email?: string;
  password?: string;
}

// ─── Validation (mirrors Angular Validators from login.component.ts) ─────────

function validateForm(email: string, password: string): FormErrors {
  const errors: FormErrors = {};

  if (!email.trim()) {
    errors.email = 'Email is required.';
  } else if (email.length < 3 || !email.includes('@')) {
    errors.email = 'Enter a valid work email address.';
  } else if (email.length > 320) {
    errors.email = 'Email should have maximum 320 characters.';
  }

  if (!password) {
    errors.password = 'Password is required.';
  } else if (password.length < 3 || password.length > 100) {
    errors.password = 'Password must be between 3 and 100 characters.';
  }

  return errors;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LoginScreen({ onLoginSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Invalid email or password. Please verify your credentials and try again.');
  const [touched, setTouched] = useState({ email: false, password: false });

  // Shake animation for error feedback
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // On mount: play entry animation and restore remembered email
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();

    restoreRememberedEmail();
  }, []);

  const restoreRememberedEmail = async () => {
    try {
      const shouldRemember = await AsyncStorage.getItem(REMEMBER_PREFERENCE_KEY);
      const rememberedEmail = await AsyncStorage.getItem(REMEMBERED_EMAIL_KEY);
      if (shouldRemember === 'true') {
        setRememberMe(true);
        if (rememberedEmail) setEmail(rememberedEmail);
      } else {
        setRememberMe(false);
      }
    } catch (e) {
      console.error('Failed to restore remembered email', e);
    }
  };

  const persistRememberedEmail = async () => {
    try {
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim());
        await AsyncStorage.setItem(REMEMBER_PREFERENCE_KEY, 'true');
      } else {
        await AsyncStorage.removeItem(REMEMBERED_EMAIL_KEY);
        await AsyncStorage.setItem(REMEMBER_PREFERENCE_KEY, 'false');
      }
    } catch (e) {
      console.error('Failed to persist remembered email', e);
    }
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const errors = validateForm(email, password);
  const isFormValid = Object.keys(errors).length === 0;

  const handleSubmit = async () => {
    setTouched({ email: true, password: true });
    if (!isFormValid) {
      triggerShake();
      return;
    }

    setIsLoading(true);
    setHasError(false);

    try {
      await persistRememberedEmail();
      await AuthService.login(email.trim(), password);
      onLoginSuccess?.();
    } catch (err: any) {
      setHasError(true);
      const msg = err?.response?.data?.message || err?.response?.data?.title;
      if (msg) setErrorMessage(msg);
      else setErrorMessage('Invalid email or password. Please verify your credentials and try again.');
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#f3f4f6" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }, { translateX: shakeAnim }],
              },
            ]}
          >
            {/* ── Header ────────────────────────────────────────────── */}
            <View style={styles.header}>
              <View style={styles.logoWrapper}>
                <Image 
                  source={require('../../assets/logos/cat20.png')} 
                  style={styles.logoImage} 
                  resizeMode="contain" 
                />
              </View>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>CAT2020 CMS</Text>
              </View>
              <Text style={styles.title}>Complaint Management System</Text>
              <Text style={styles.subtitle}>Sign in with your official credentials.</Text>
            </View>

            {/* ── Error Alert ───────────────────────────────────────── */}
            {hasError && (
              <View style={styles.alertDanger}>
                <Text style={styles.alertIcon}>⚠️</Text>
                <Text style={styles.alertText}>{errorMessage}</Text>
              </View>
            )}

            {/* ── Email Field ───────────────────────────────────────── */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Work Email</Text>
              <View
                style={[
                  styles.inputWrapper,
                  touched.email && errors.email ? styles.inputWrapperError : null,
                ]}
              >
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  style={styles.input}
                  placeholder="name@agency.gov.lk"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setHasError(false);
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={!isLoading}
                  returnKeyType="next"
                />
              </View>
              {touched.email && errors.email && (
                <View style={styles.errorRow}>
                  <Text style={styles.errorIcon}>!</Text>
                  <Text style={styles.errorText}>{errors.email}</Text>
                </View>
              )}
            </View>

            {/* ── Password Field ────────────────────────────────────── */}
            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <TouchableOpacity>
                  <Text style={styles.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <View
                style={[
                  styles.inputWrapper,
                  touched.password && errors.password ? styles.inputWrapperError : null,
                ]}
              >
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setHasError(false);
                  }}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                />
                <TouchableOpacity
                  style={styles.eyeToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
              {touched.password && errors.password && (
                <View style={styles.errorRow}>
                  <Text style={styles.errorIcon}>!</Text>
                  <Text style={styles.errorText}>{errors.password}</Text>
                </View>
              )}
            </View>

            {/* ── Options Row ───────────────────────────────────────── */}
            <View style={styles.optionsRow}>
              <View style={styles.checkboxRow}>
                <Switch
                  value={rememberMe}
                  onValueChange={setRememberMe}
                  trackColor={{ false: '#d1d5db', true: '#60a5fa' }}
                  thumbColor={rememberMe ? '#2563eb' : '#f3f4f6'}
                  disabled={isLoading}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />
                <Text style={styles.rememberText} onPress={() => setRememberMe(!rememberMe)}>
                  Remember me
                </Text>
              </View>
            </View>

            {/* ── Submit Button ─────────────────────────────────────── */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                (isLoading || (!isFormValid && touched.email && touched.password)) && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color="#ffffff" size="small" />
                  <Text style={styles.submitBtnText}>  Signing in…</Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>Sign in</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const PRIMARY = '#2563eb'; // Deep blue
const PRIMARY_HOVER = '#1d4ed8';
const DANGER = '#ef4444'; // Red
const DANGER_BG = '#fef2f2';
const TEXT_MAIN = '#111827';
const TEXT_MUTED = '#6b7280';
const BORDER = '#d1d5db';
const BG_MAIN = '#f3f4f6';
const BG_CARD = '#ffffff';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG_MAIN,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: BG_CARD,
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoWrapper: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  badge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  badgeText: {
    color: '#1e40af',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_MAIN,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: 'center',
  },

  // Alert
  alertDanger: {
    flexDirection: 'row',
    backgroundColor: DANGER_BG,
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  alertIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  alertText: {
    color: '#b91c1c',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  // Form Fields
  formGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  forgotLink: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    height: 52,
    paddingHorizontal: 12,
  },
  inputWrapperError: {
    borderColor: DANGER,
    backgroundColor: '#fffcfc',
  },
  inputIcon: {
    fontSize: 16,
    color: '#9ca3af',
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: TEXT_MAIN,
    height: '100%',
  },
  eyeToggle: {
    padding: 8,
  },
  eyeIcon: {
    fontSize: 18,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  errorIcon: {
    color: '#fff',
    backgroundColor: DANGER,
    width: 14,
    height: 14,
    borderRadius: 7,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: 'bold',
    overflow: 'hidden',
    marginRight: 6,
    lineHeight: 14,
  },
  errorText: {
    color: DANGER,
    fontSize: 12,
    fontWeight: '500',
  },

  // Options
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rememberText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },

  // Submit
  submitBtn: {
    backgroundColor: PRIMARY,
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#93c5fd',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
