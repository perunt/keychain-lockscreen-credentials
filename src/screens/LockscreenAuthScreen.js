import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import LockscreenUtils from '../utils/LockscreenUtils';
import { MMKV } from 'react-native-mmkv';

// Create a separate storage instance for app security settings
const securityStorage = new MMKV({
  id: 'app-security-storage',
});

const LockscreenAuthScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [biometricInfo, setBiometricInfo] = useState({ available: false, displayName: 'None' });
  const [lockscreenEnabled, setLockscreenEnabled] = useState(false);
  const [appLocked, setAppLocked] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const [authAttempts, setAuthAttempts] = useState(0);

  // Handle back button to prevent bypassing authentication
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        if (appLocked) {
          // If app is locked, prevent going back
          return true;
        }
        // Let the default handler deal with it
        return false;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [appLocked])
  );

  useEffect(() => {
    const checkAppSecurity = async () => {
      setLoading(true);
      
      // Check if app requires authentication
      const appSecurityEnabled = securityStorage.getBoolean('appSecurityEnabled');
      
      // If security is not enabled, skip authentication
      if (!appSecurityEnabled) {
        setAppLocked(false);
        setLoading(false);
        navigation.replace('Home');
        return;
      }
      
      // Check biometric availability
      const bioInfo = await LockscreenUtils.getBiometricInfo();
      setBiometricInfo(bioInfo);
      
      // Check lockscreen status
      const lockEnabled = await LockscreenUtils.isLockscreenEnabled();
      setLockscreenEnabled(lockEnabled);
      
      // If lockscreen is not enabled, show warning but proceed
      if (!lockEnabled) {
        Alert.alert(
          'Security Warning',
          'Your device does not have a lockscreen security method set up. This significantly reduces the security of your stored credentials.',
          [{ text: 'Proceed Anyway', onPress: () => proceedToApp() }]
        );
      } else {
        // Start authentication automatically
        authenticateUser();
      }
      
      setLoading(false);
    };
    
    checkAppSecurity();
  }, [navigation]);

  const authenticateUser = async () => {
    if (authenticating) return;
    
    setAuthenticating(true);
    setAuthAttempts(prevAttempts => prevAttempts + 1);
    
    try {
      const androidMessage = Platform.OS === 'android' 
        ? 'Please verify your identity using your screen lock'
        : 'Authenticate to access your credentials';
        
      const success = await LockscreenUtils.authenticateWithLockscreen({
        promptMessage: androidMessage,
        fallbackToPasscode: true,
      });
      
      if (success) {
        setAppLocked(false);
        proceedToApp();
      } else {
        // Authentication failed or was canceled
        setAuthenticating(false);
        
        // For Android, show a custom alert that prompts retry
        if (Platform.OS === 'android') {
          Alert.alert(
            'Authentication Required',
            'You need to verify your identity to access your credentials.',
            [
              { 
                text: 'Try Again', 
                onPress: () => {
                  // Small delay to ensure previous dialog is dismissed
                  setTimeout(() => authenticateUser(), 500);
                }
              },
              {
                text: 'Exit App',
                onPress: () => exitApp(),
                style: 'cancel'
              }
            ]
          );
        } else {
          // For iOS, just allow retry with the button
          Alert.alert(
            'Authentication Failed',
            'Please try again to access your credentials.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setAuthenticating(false);
      
      // If we've tried 3 times with errors, show a more helpful message
      if (authAttempts >= 3) {
        Alert.alert(
          'Authentication Problems',
          'There seem to be issues with device authentication. Please make sure your device has screen lock properly set up in system settings.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Authentication Error',
          'There was a problem with authentication. Please try again.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  const proceedToApp = () => {
    navigation.replace('Home');
  };

  const exitApp = () => {
    // for Android this will minimize the app
    // for iOS this doesn't actually exit but takes user back to previous screen
    BackHandler.exitApp();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Preparing secure environment...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>LockscreenCredentialsExample</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Icon name="lock" size={80} color="#2196F3" />
        </View>
        
        <Text style={styles.title}>Authentication Required</Text>
        
        <Text style={styles.description}>
          {Platform.OS === 'android' 
            ? 'Please verify your identity using your device\'s screen lock (PIN, pattern, password, or fingerprint).' 
            : 'Please authenticate using your device\'s security method to access your saved credentials.'}
        </Text>
        
        {!lockscreenEnabled && (
          <View style={styles.warningContainer}>
            <Icon name="warning" size={24} color="#FFC107" />
            <Text style={styles.warningText}>
              Your device doesn't have a lockscreen security method set up.
              For better security, please set up a PIN, pattern, or biometrics in your device settings.
            </Text>
          </View>
        )}
        
        <TouchableOpacity
          style={styles.authButton}
          onPress={authenticateUser}
          disabled={authenticating}
        >
          {authenticating ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Icon 
                name={biometricInfo.available ? "fingerprint" : "lock"} 
                size={24} 
                color="white" 
                style={styles.buttonIcon}
              />
              <Text style={styles.authButtonText}>
                {Platform.OS === 'android'
                  ? 'Verify Identity with Screen Lock'
                  : biometricInfo.available 
                    ? `Authenticate with ${biometricInfo.displayName}` 
                    : 'Authenticate with Device Passcode'
                }
              </Text>
            </>
          )}
        </TouchableOpacity>
        
        {Platform.OS === 'android' && (
          <Text style={styles.androidNote}>
            On Android, you'll need to use your screen lock (PIN, pattern, password or fingerprint)
            to access your credentials.
          </Text>
        )}
        
        <TouchableOpacity
          style={styles.exitButton}
          onPress={exitApp}
        >
          <Text style={styles.exitButtonText}>
            Exit App
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#757575',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 32,
  },
  warningContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 16,
    marginBottom: 32,
    alignItems: 'center',
  },
  warningText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#FF8F00',
  },
  androidNote: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  authButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 16,
  },
  buttonIcon: {
    marginRight: 12,
  },
  authButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  exitButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
  },
  exitButtonText: {
    color: '#757575',
    fontSize: 16,
  },
});

export default LockscreenAuthScreen;