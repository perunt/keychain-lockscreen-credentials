import React, { useState, useEffect } from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MMKV } from 'react-native-mmkv';

import HomeScreen from './src/screens/HomeScreen';
import CredentialDetailScreen from './src/screens/CredentialDetailScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LockscreenAuthScreen from './src/screens/LockscreenAuthScreen';

const securityStorage = new MMKV({
  id: 'app-security-storage',
});

const Stack = createNativeStackNavigator();

const App = () => {
  const [initializing, setInitializing] = useState(true);
  const [securityEnabled, setSecurityEnabled] = useState(false);

  useEffect(() => {
    const checkSecuritySettings = async () => {
      const appSecurityEnabled = securityStorage.getBoolean('appSecurityEnabled');
      setSecurityEnabled(!!appSecurityEnabled);
      setInitializing(false);
    };

    checkSecuritySettings();
  }, []);

  if (initializing) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar backgroundColor="#1976D2" barStyle="light-content" />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={securityEnabled ? "Auth" : "Home"}
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen 
            name="Auth" 
            component={LockscreenAuthScreen}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="CredentialDetail" component={CredentialDetailScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;