// AppNavigator.tsx — Root navigation stack
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet, DeviceEventEmitter } from 'react-native';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SessionStorage } from '../storage/SessionStorage';

// ─── Route type definitions ───────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
  ComplaintDetail: { complaintNumber: string };
  Profile: undefined;
  ChangePassword: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { ComplaintDetailScreen } from '../screens/dashboard/ComplaintDetailScreen';
import { ProfileScreen } from '../screens/user/ProfileScreen';
import { ChangePasswordScreen } from '../screens/user/ChangePasswordScreen';

// ─── Navigator ───────────────────────────────────────────────────────────────

export function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check for existing session on startup — mirrors AuthService constructor
    SessionStorage.getToken()
      .then(token => setIsLoggedIn(!!token))
      .finally(() => setIsLoading(false));

    const logoutListener = DeviceEventEmitter.addListener('LOGOUT', () => {
      setIsLoggedIn(false);
    });

    return () => {
      logoutListener.remove();
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#3e97ff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isLoggedIn ? (
          <>
            <Stack.Screen name="Dashboard" component={DashboardScreen} />
            <Stack.Screen name="ComplaintDetail" component={ComplaintDetailScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
          </>
        ) : (
          <Stack.Screen name="Login">
            {() => <LoginScreen onLoginSuccess={() => setIsLoggedIn(true)} />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
