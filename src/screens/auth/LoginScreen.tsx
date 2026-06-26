// LoginScreen.tsx — Mobile login screen matching cat2020-cms-frontend login page
// Updated to match the high-fidelity Complaint Management System design.

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
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from '../../services/AuthService';

// ─── Constants ───────────────────────────────────────────────────────────────

const REMEMBERED_EMAIL_KEY = 'cms_login_email';
const REMEMBER_PREFERENCE_KEY = 'cms_login_remember';
const { width } = Dimensions.get('window');

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
    errors.email = 'Username / Email is required.';
  } else if (email.length < 3) {
    errors.email = 'Enter a valid username.';
  } else if (email.length > 320) {
    errors.email = 'ID should have maximum 320 characters.';
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
  const [errorMessage, setErrorMessage] = useState('Invalid username or password. Please try again.');
  const [touched, setTouched] = useState({ email: false, password: false });

  // Animations
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // On mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
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
      else setErrorMessage('Invalid username or password. Please try again.');
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" backgroundColor="#0f3c88" />

      {/* Deep Blue Background */}
      <View style={styles.blueBackgroundContainer}>
        <View style={styles.blueBackgroundAngle} />
        <View style={styles.blueBackgroundSolid} />
      </View>

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
          {/* ── Top Header Branding ─────────────────────────────── */}
          <View style={styles.headerBranding}>
            <Image
              source={require('../../assets/logos/cat20.png')}
              style={[styles.logoImage, { tintColor: '#ffffff' }]}
              resizeMode="contain"
            />
            <View style={styles.titleRow}>
              <Text style={styles.mainTitle}>CAT2020</Text>
              <View style={styles.cmsBadge}>
                <Text style={styles.cmsBadgeText}>CMS</Text>
              </View>
            </View>
            <Text style={styles.subTitleText}>COMPLAINT MANAGEMENT SYSTEM</Text>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLineBlue} />
              <Text style={styles.mobileAppText}>OFFICIAL PORTAL</Text>
              <View style={styles.dividerLineBlue} />
            </View>
          </View>

          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { translateX: shakeAnim }],
            }}
          >
            {/* ── Main Login Card ───────────────────────────────────── */}
            <View style={styles.loginCard}>
              <View style={styles.welcomeRow}>
                <View style={styles.shieldIconLarge}>
                  <Text style={{ fontSize: 22, color: '#fff' }}>🛡️</Text>
                </View>
                <View style={styles.welcomeTextCol}>
                  <Text style={styles.welcomeTitle}>Welcome Back!</Text>
                  <Text style={styles.welcomeSub}>Secure access for Department Heads</Text>
                  <Text style={styles.welcomeSub}>and Subject Officers .</Text>
                </View>
              </View>

              {hasError && (
                <View style={styles.alertBox}>
                  <Text style={styles.alertText}>{errorMessage}</Text>
                </View>
              )}

              {/* Username Field */}
              <View style={styles.formGroup}>
                <View
                  style={[
                    styles.inputContainer,
                    touched.email && errors.email ? styles.inputContainerError : null,
                  ]}
                >
                  <TextInput
                    style={styles.textInput}
                    placeholder="Username"
                    placeholderTextColor="#9ca3af"
                    value={email}
                    onChangeText={(text) => { setEmail(text); setHasError(false); }}
                    onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    editable={!isLoading}
                    returnKeyType="next"
                  />
                </View>
                {touched.email && errors.email && (
                  <Text style={styles.errorTextSmall}>{errors.email}</Text>
                )}
              </View>

              {/* Password Field */}
              <View style={styles.formGroup}>
                <View
                  style={[
                    styles.inputContainer,
                    touched.password && errors.password ? styles.inputContainerError : null,
                  ]}
                >
                  <TextInput
                    style={styles.textInput}
                    placeholder="Password"
                    placeholderTextColor="#9ca3af"
                    value={password}
                    onChangeText={(text) => { setPassword(text); setHasError(false); }}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                    <Image
                      source={{ uri: showPassword ? 'https://img.icons8.com/ios-filled/50/9ca3af/visible.png' : 'https://img.icons8.com/ios-filled/50/9ca3af/invisible.png' }}
                      style={{ width: 22, height: 22, tintColor: '#9ca3af' }}
                    />
                  </TouchableOpacity>
                </View>
                {touched.password && errors.password && (
                  <Text style={styles.errorTextSmall}>{errors.password}</Text>
                )}
              </View>

              {/* Options Row */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.checkboxWrapper}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <Text style={styles.checkIcon}>✓</Text>}
                  </View>
                  <Text style={styles.rememberText}>Remember Me</Text>
                </TouchableOpacity>

                <TouchableOpacity>
                  <Text style={styles.forgotPassText}>Forgot Password?</Text>
                </TouchableOpacity>
              </View>

              {/* Submit Button */}
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
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ marginRight: 8, fontSize: 16 }}>🛡️</Text>
                    <Text style={styles.submitBtnText}>SIGN IN SECURELY</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Card Divider */}
              <View style={styles.cardDividerRow}>
                <View style={styles.cardDividerLine} />
                <View style={styles.cardDividerShield}>
                  <Text style={{ fontSize: 12 }}>🛡️</Text>
                </View>
                <View style={styles.cardDividerLine} />
              </View>

              {/* Info Box */}
              <View style={styles.infoBox}>
                <View style={styles.infoBoxIcon}>
                  <Text style={{ fontSize: 20 }}>🔒</Text>
                </View>
                <View style={styles.infoBoxTextCol}>
                  <Text style={styles.infoBoxTitle}>Secure Government Network</Text>
                  <Text style={styles.infoBoxDesc}>Only authorized personnel may access complaint data and system information.</Text>
                </View>
                <View style={styles.infoBoxRightIcon}>
                  <Text style={{ fontSize: 32 }}>🏛️</Text>
                  <View style={styles.infoBoxCheckBadge}>
                    <Text style={{ fontSize: 10, color: '#fff' }}>✓</Text>
                  </View>
                </View>
              </View>

            </View>

            {/* ── Features Row Cards ────────────────────────────────────── */}
            <View style={styles.statRowCard}>
              <View style={styles.statItem}>
                <View style={[styles.statIconCircle, { backgroundColor: '#eff6ff' }]}>
                  <Text style={[styles.statIcon, { color: '#2563eb' }]}>📋</Text>
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statNumber, { color: '#2563eb', fontSize: 13 }]}>Track</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statLabel}>Complaints</Text>
              </View>

              <View style={styles.statItem}>
                <View style={[styles.statIconCircle, { backgroundColor: '#ecfdf5' }]}>
                  <Text style={[styles.statIcon, { color: '#10b981' }]}>🏛️</Text>
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statNumber, { color: '#10b981', fontSize: 13 }]}>Manage</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statLabel}>Departments</Text>
              </View>

              <View style={styles.statItem}>
                <View style={[styles.statIconCircle, { backgroundColor: '#fff7ed' }]}>
                  <Text style={[styles.statIcon, { color: '#f97316' }]}>⏱️</Text>
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statNumber, { color: '#f97316', fontSize: 13 }]}>Resolve</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statLabel}>Cases</Text>
              </View>

              <View style={styles.statItem}>
                <View style={[styles.statIconCircle, { backgroundColor: '#f5f3ff' }]}>
                  <Text style={[styles.statIcon, { color: '#8b5cf6' }]}>🛡️</Text>
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.statNumber, { color: '#8b5cf6', fontSize: 13 }]}>Secure</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={styles.statLabel}>Platform</Text>
              </View>
            </View>

            {/* ── Footer ────────────────────────────────────────────── */}
            <View style={styles.footerRow}>
              <View style={styles.footerHelpBox}>
                <View style={styles.footerHelpIcon}>
                  <Text style={{ fontSize: 22 }}>🎧</Text>
                </View>
                <View>
                  <Text style={styles.footerHelpTitle}>Need Help?</Text>
                  <Text style={styles.footerHelpSub}>Contact System Administrator</Text>
                </View>
              </View>
            </View>

            <View style={styles.copyrightBox}>
              <Text style={styles.copyrightTextBold}>CAT2020 Complaint Management System</Text>
              <Text style={styles.copyrightText}>Version 1.0.0</Text>
              <Text style={styles.copyrightText}>© 2026 Government Service Platform. All rights reserved.</Text>
            </View>

          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const PRIMARY_BLUE = '#003399';
const ACCENT_BLUE = '#2563eb';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 30,
  },

  // Background
  blueBackgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
  },
  blueBackgroundSolid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 340,
    backgroundColor: PRIMARY_BLUE,
  },
  blueBackgroundAngle: {
    position: 'absolute',
    bottom: 0,
    left: -100,
    right: -100,
    height: 200,
    backgroundColor: PRIMARY_BLUE,
    transform: [{ skewY: '-10deg' }],
  },

  // Branding Header
  headerBranding: {
    alignItems: 'center',
    paddingTop: 30,
    paddingBottom: 20,
  },
  logoImage: {
    width: 100,
    height: 100,
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
    marginRight: 10,
  },
  cmsBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cmsBadgeText: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 16,
  },
  subTitleText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '60%',
  },
  dividerLineBlue: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  mobileAppText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '600',
    marginHorizontal: 10,
    letterSpacing: 1,
  },

  // Stat Row
  statRowCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 8,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 2,
    justifyContent: 'space-evenly',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
    width: '25%',
    paddingHorizontal: 2,
  },
  statIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statIcon: {
    fontSize: 18,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#4b5563',
    textAlign: 'center',
  },

  // Login Card
  loginCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  shieldIconLarge: {
    width: 48,
    height: 48,
    backgroundColor: PRIMARY_BLUE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  welcomeTextCol: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 4,
  },
  welcomeSub: {
    fontSize: 12,
    color: '#64748b',
  },

  alertBox: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  alertText: {
    color: '#ef4444',
    fontSize: 13,
    textAlign: 'center',
  },

  formGroup: {
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    height: 52,
    paddingHorizontal: 16,
  },
  inputContainerError: {
    borderColor: '#ef4444',
    backgroundColor: '#fffcfc',
  },
  inputLeftIcon: {
    fontSize: 16,
    color: '#94a3b8',
    marginRight: 12,
  },
  inputRightIcon: {
    fontSize: 16,
    color: '#94a3b8',
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
    height: '100%',
  },
  eyeBtn: {
    padding: 4,
  },
  errorTextSmall: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },

  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: 4,
  },
  checkboxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: PRIMARY_BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: PRIMARY_BLUE,
  },
  checkIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    lineHeight: 16,
  },
  rememberText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '500',
  },
  forgotPassText: {
    fontSize: 14,
    color: ACCENT_BLUE,
    fontWeight: '600',
  },

  submitBtn: {
    backgroundColor: PRIMARY_BLUE,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: PRIMARY_BLUE,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 24,
  },
  submitBtnDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  cardDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  cardDividerShield: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },

  infoBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoBoxIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#e2e8f0',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoBoxTextCol: {
    flex: 1,
  },
  infoBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 2,
  },
  infoBoxDesc: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
  infoBoxRightIcon: {
    position: 'relative',
    marginLeft: 8,
  },
  infoBoxCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#10b981',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerHelpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  footerHelpIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#e2e8f0',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  footerHelpTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  footerHelpSub: {
    fontSize: 11,
    color: '#64748b',
  },
  supportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  supportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY_BLUE,
  },

  copyrightBox: {
    marginTop: 32,
    alignItems: 'center',
  },
  copyrightTextBold: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 2,
  },
  copyrightText: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 2,
  },
});
