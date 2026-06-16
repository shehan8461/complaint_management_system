// AppNavigator.tsx — Root navigation stack
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { SessionStorage } from '../storage/SessionStorage';

// ─── Route type definitions ───────────────────────────────────────────────────

export type RootStackParamList = {
  Login: undefined;
  Dashboard: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// Placeholder Dashboard screen (replace with your actual screen)
function DashboardScreen() {
  const React = require('react');
  const { View, Text, StyleSheet: RNStyles } = require('react-native');
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: '#181c32' }}>
        🎉 Welcome!
      </Text>
      <Text style={{ fontSize: 14, color: '#7e8299', marginTop: 8 }}>
        Dashboard coming soon...
      </Text>
    </View>
  );
}

// ─── Navigator ───────────────────────────────────────────────────────────────

export function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check for existing session on startup — mirrors AuthService constructor
    SessionStorage.getToken()
      .then(token => setIsLoggedIn(!!token))
      .finally(() => setIsLoading(false));
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
      <Stack.Navigator
        initialRouteName={isLoggedIn ? 'Dashboard' : 'Login'}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login">
          {() => <LoginScreen onLoginSuccess={() => setIsLoggedIn(true)} />}
        </Stack.Screen>
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
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
