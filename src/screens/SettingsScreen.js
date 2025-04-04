import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MMKV } from 'react-native-mmkv';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LockscreenUtils from '../utils/LockscreenUtils';
import StorageService from '../services/StorageService';

// Create a separate storage instance for app security settings
const securityStorage = new MMKV({
  id: 'app-security-storage',
});

const SettingsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [appSecurityEnabled, setAppSecurityEnabled] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [lockscreenEnabled, setLockscreenEnabled] = useState(false);
  const [biometryType, setBiometryType] = useState('None');
  const [authenticating, setAuthenticating] = useState(false);

  const insets = useSafeAreaInsets();

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      
      // Load current settings
      const securityEnabled = securityStorage.getBoolean('appSecurityEnabled') || false;
      setAppSecurityEnabled(securityEnabled);
      
      // Check biometric availability
      const bioInfo = await LockscreenUtils.getBiometricInfo();
      setBiometricsAvailable(bioInfo.available);
      setBiometryType(bioInfo.displayName);
      
      // Check lockscreen status
      const lockEnabled = await LockscreenUtils.isLockscreenEnabled();
      setLockscreenEnabled(lockEnabled);
      
      setLoading(false);
    };
    
    loadSettings();
  }, []);

  const toggleAppSecurity = async (value) => {
    // If turning on security, verify device has lockscreen security
    if (value && !lockscreenEnabled) {
      Alert.alert(
        'Security Warning',
        'Your device does not have a lockscreen security method (PIN, pattern, or biometrics) set up. ' +
        'This significantly reduces the security of your stored credentials. ' +
        'Would you like to enable app security anyway?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Enable Anyway',
            onPress: () => saveSecuritySetting(value),
          },
        ]
      );
      return;
    }
    
    // If turning on security, authenticate first
    if (value) {
      authenticateAndToggle(value);
    } else {
      // If turning off security, authenticate first to verify user
      authenticateAndToggle(value);
    }
  };

  const authenticateAndToggle = async (newValue) => {
    setAuthenticating(true);
    
    try {
      const success = await LockscreenUtils.authenticateWithLockscreen({
        promptMessage: newValue 
          ? 'Authenticate to enable app security' 
          : 'Authenticate to disable app security',
        fallbackToPasscode: true,
      });
      
      if (success) {
        saveSecuritySetting(newValue);
      }
    } catch (error) {
      console.error('Authentication error:', error);
      Alert.alert('Error', 'Authentication failed. Settings not changed.');
    } finally {
      setAuthenticating(false);
    }
  };

  const saveSecuritySetting = (value) => {
    // Save to secure storage
    securityStorage.set('appSecurityEnabled', value);
    setAppSecurityEnabled(value);
    
    // Show appropriate message
    if (value) {
      Alert.alert(
        'Security Enabled',
        'App security has been enabled. You will need to authenticate each time you open the app.'
      );
    } else {
      Alert.alert(
        'Security Disabled',
        'App security has been disabled. Anyone with access to your device can open the app without authentication.'
      );
    }
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your saved credentials. This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Authenticate user before allowing data deletion
              const success = await LockscreenUtils.authenticateWithLockscreen({
                promptMessage: 'Authenticate to delete all data',
                fallbackToPasscode: true,
              });
              
              if (!success) {
                setLoading(false);
                return;
              }
              
              // Get all items
              const items = StorageService.getItemsList();
              
              // Delete each credential
              for (const item of items) {
                await StorageService.deleteCredential(item);
              }
              
              // Reset items list
              StorageService.saveItemsList([]);
              
              setLoading(false);
              
              Alert.alert(
                'Data Cleared',
                'All credentials have been deleted from the app.',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.navigate('Home'),
                  },
                ]
              );
            } catch (error) {
              setLoading(false);
              console.error('Error clearing data:', error);
              Alert.alert('Error', 'Failed to clear app data');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          
          <View style={styles.settingContainer}>
            <View style={styles.settingTextContainer}>
              <Text style={styles.settingLabel}>
                Require Authentication
              </Text>
              <Text style={styles.settingDescription}>
                Require authentication when opening the app
              </Text>
            </View>
            {authenticating ? (
              <ActivityIndicator size="small" color="#2196F3" />
            ) : (
              <Switch
                value={appSecurityEnabled}
                onValueChange={toggleAppSecurity}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={appSecurityEnabled ? '#2196F3' : '#f4f3f4'}
              />
            )}
          </View>
          
          <View style={styles.infoContainer}>
            <Icon name="info" size={20} color="#757575" />
            <Text style={styles.infoText}>
              Security status: {lockscreenEnabled 
                ? 'Device has lockscreen security' 
                : 'No lockscreen security detected'}
            </Text>
          </View>
          
          {biometricsAvailable && (
            <View style={styles.infoContainer}>
              <Icon name="fingerprint" size={20} color="#757575" />
              <Text style={styles.infoText}>
                Biometric authentication available: {biometryType}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          
          <TouchableOpacity 
            style={styles.dangerButton}
            onPress={clearAllData}
          >
            <Icon name="delete-forever" size={20} color="white" style={styles.buttonIcon} />
            <Text style={styles.dangerButtonText}>
              Clear All Data
            </Text>
          </TouchableOpacity>
          
          <Text style={styles.warningText}>
            This will permanently delete all your saved credentials.
          </Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          
          <Text style={styles.aboutText}>
            LockscreenCredentialsExample
          </Text>
          
          <Text style={styles.versionText}>
            Version 1.0.0
          </Text>
          
          <Text style={styles.descriptionText}>
            A demonstration app showing how to use device lockscreen credentials
            to secure sensitive information using React Native Keychain and MMKV.
          </Text>
        </View>
      </ScrollView>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#757575',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 8,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  settingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#757575',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#757575',
  },
  dangerButton: {
    backgroundColor: '#F44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
  dangerButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  warningText: {
    fontSize: 12,
    color: '#757575',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  aboutText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  versionText: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default SettingsScreen;