import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Switch,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  Clipboard,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import StorageService from '../services/StorageService';

const CredentialDetailScreen = ({ route, navigation }) => {
  const { itemKey } = route.params;
  const [loading, setLoading] = useState(true);
  const [credential, setCredential] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [passcodeAvailable, setPasscodeAvailable] = useState(false);
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [useDevicePasscode, setUseDevicePasscode] = useState(false);
  const [biometryType, setBiometryType] = useState('None');
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

  useEffect(() => {
    const checkSecurity = async () => {
      const bioResult = await StorageService.checkBiometricAvailability();
      setBiometricsAvailable(bioResult.available);
      setBiometryType(bioResult.displayName);

      const passcodeResult = await StorageService.checkDevicePasscodeAvailability();
      setPasscodeAvailable(passcodeResult);
    };

    checkSecurity();
    loadCredential();
  }, [itemKey]);

  const loadCredential = async () => {
    setLoading(true);
    try {
      // Try to load metadata first to check security settings
      const metadataStr = StorageService.storage.getString(`metadata_${itemKey}`);
      let metadata = {};
      
      if (metadataStr) {
        metadata = JSON.parse(metadataStr);
        setUseBiometrics(!!metadata.useBiometrics);
        setUseDevicePasscode(!!metadata.useDevicePasscode);
      }
      
      // on android, if credential requires authentication, 
      // go straight to authenticated access
      const requiresAuth = metadata.useBiometrics || metadata.useDevicePasscode;
      if (Platform.OS === 'android' && requiresAuth) {
        await loadWithAuthentication();
        return;
      }
      
      // For iOS or non-secured credentials, try regular access first
      const cred = await StorageService.getCredential(itemKey);
      setCredential(cred);
      
      // if we couldn't load directly and it requires auth, try authenticated access
      if (!cred && requiresAuth) {
        await loadWithAuthentication();
      }
    } catch (error) {
      console.error('Error loading credential:', error);
      
      // If error indicates authentication needed, try authenticated access
      if (error.message && (
        error.message.includes('authentication required') ||
        error.message.includes('user not authenticated')
      )) {
        await loadWithAuthentication();
      } else {
        Alert.alert('Error', 'Failed to load credential details');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadWithAuthentication = async () => {
    setLoading(true);
    try {
      // Get metadata first to determine what authentication type to use
      const metadataStr = StorageService.storage.getString(`metadata_${itemKey}`);
      let requiresBiometrics = false;
      let requiresPasscode = false;
      
      if (metadataStr) {
        const metadata = JSON.parse(metadataStr);
        requiresBiometrics = !!metadata.useBiometrics;
        requiresPasscode = !!metadata.useDevicePasscode;
      }
      
      let promptMessage = `Authenticate to access "${itemKey}" details`;
      
      if (Platform.OS === 'android') {
        promptMessage = `Verify your identity to access "${itemKey}"`;
      } else if (requiresBiometrics && biometryType) {
        promptMessage = `Use ${biometryType} to access "${itemKey}"`;
      } else if (requiresPasscode) {
        promptMessage = `Enter your device passcode to access "${itemKey}"`;
      }
      
      // for Android, we need specific options
      const authOptions = {
        useBiometrics: true,
        promptMessage,
      };
      
      // On Android, add these extra options
      if (Platform.OS === 'android') {
        authOptions.authenticationType = 'DEVICE_PASSCODE_OR_BIOMETRICS';
        authOptions.accessControl = requiresBiometrics ? 
          'BIOMETRY_ANY' : 'DEVICE_PASSCODE';
      }
      
      const cred = await StorageService.getCredential(itemKey, authOptions);
      
      if (cred) {
        setCredential(cred);
        setShowPassword(true);
      } else {
        // Handle authentication failure
        if (Platform.OS === 'android') {
          Alert.alert(
            'Authentication Required',
            'You need to verify your identity to access this credential.',
            [
              { 
                text: 'Try Again', 
                onPress: () => {
                  // Sall delay to ensure previous dialog is dismissed
                  setTimeout(() => loadWithAuthentication(), 500);
                }
              },
              {
                text: 'Go Back',
                onPress: () => navigation.goBack(),
                style: 'cancel'
              }
            ]
          );
        } else {
          Alert.alert('Error', 'Authentication failed or credential not found');
        }
      }
    } catch (error) {
      console.error('Error with authenticated access:', error);
      Alert.alert('Error', 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const copyErrorToClipboard = () => {
    if (errorDetails) {
      Clipboard.setString(errorDetails);
      Alert.alert('Copied', 'Error details copied to clipboard');
    }
  };

  const toggleSecurityOption = async (option, value) => {
    if (option === 'biometrics') {
      setUseBiometrics(value);
      if (value && useDevicePasscode) {
        setUseDevicePasscode(false);
      }
    } else if (option === 'passcode') {
      setUseDevicePasscode(value);
      if (value && useBiometrics) {
        setUseBiometrics(false);
      }
    }

    if (credential) {
      try {
        // Update credential with new security options
        const result = await StorageService.updateCredential(
          itemKey,
          credential.username,
          credential.password,
          {
            useBiometrics: option === 'biometrics' ? value : useBiometrics,
            useDevicePasscode: option === 'passcode' ? value : useDevicePasscode,
          }
        );

        if (result.success) {
          // If security option was successfully changed, show a small confirmation
          // with security details
          const securityInfo = result.securityInfo || {};
          console.log('Security options updated:', securityInfo);
          
          // Force alert to show with a small delay
          setTimeout(() => {
            Alert.alert(
              'Security Updated',
              `New security settings applied:\n\n` +
              `• Access Control: ${securityInfo.accessControlName || 'None'}\n` +
              `• Accessible: ${securityInfo.accessibleName || 'Default'}\n` +
              `• Security Level: ${securityInfo.securityLevelName || 'Default'}\n` +
              `• Using Biometrics: ${option === 'biometrics' ? value : useBiometrics ? 'Yes' : 'No'}\n` +
              `• Using Device Passcode: ${option === 'passcode' ? value : useDevicePasscode ? 'Yes' : 'No'}`
            );
          }, 100);
        } else {
          // Reset switch if failed
          if (option === 'biometrics') {
            setUseBiometrics(!value);
          } else if (option === 'passcode') {
            setUseDevicePasscode(!value);
          }
          
          const errorJson = JSON.stringify(result.error, Object.getOwnPropertyNames(result.error));
          setErrorDetails(errorJson);
          Alert.alert(
            'Error', 
            'Failed to update security options: ' + (result.error?.message || 'Unknown error'),
            [
              { text: 'OK' },
              { text: 'Show Details', onPress: () => setShowErrorModal(true) }
            ]
          );
        }
      } catch (error) {
        // Reset switch if exception occurs
        if (option === 'biometrics') {
          setUseBiometrics(!value);
        } else if (option === 'passcode') {
          setUseDevicePasscode(!value);
        }
        
        console.error('Error updating security options:', error);
        const errorJson = JSON.stringify(error, Object.getOwnPropertyNames(error));
        setErrorDetails(errorJson);
        Alert.alert(
          'Error', 
          'Failed to update security options: ' + error.message,
          [
            { text: 'OK' },
            { text: 'Show Details', onPress: () => setShowErrorModal(true) }
          ]
        );
      }
      
      // Update metadata
      try {
        const metadataStr = StorageService.storage.getString(`metadata_${itemKey}`);
        if (metadataStr) {
          const metadata = JSON.parse(metadataStr);
          metadata.useBiometrics = option === 'biometrics' ? value : useBiometrics;
          metadata.useDevicePasscode = option === 'passcode' ? value : useDevicePasscode;
          StorageService.storage.set(`metadata_${itemKey}`, JSON.stringify(metadata));
        }
      } catch (metadataError) {
        console.error('Error updating metadata:', metadataError);
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Loading credential details...</Text>
      </View>
    );
  }

  if (!credential) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={64} color="#FF5252" />
        <Text style={styles.errorText}>Credential not found or access denied</Text>
        <TouchableOpacity 
          style={styles.authButton}
          onPress={loadWithAuthentication}
        >
          <Text style={styles.authButtonText}>
            Authenticate to Access
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{itemKey}</Text>
          </View>

          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Credential Information</Text>
              
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Username</Text>
                <Text style={styles.fieldValue}>{credential.username}</Text>
              </View>
              
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Password/Value</Text>
                <View style={styles.passwordContainer}>
                  <Text style={styles.fieldValue}>
                    {showPassword ? credential.password : '••••••••••••'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.visibilityButton}
                  >
                    <Icon
                      name={showPassword ? 'visibility-off' : 'visibility'}
                      size={24}
                      color="#2196F3"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {credential.metadata && (
                <>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Created</Text>
                    <Text style={styles.fieldValue}>
                      {formatDate(credential.metadata.createdAt)}
                    </Text>
                  </View>
                  
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Last Updated</Text>
                    <Text style={styles.fieldValue}>
                      {formatDate(credential.metadata.updatedAt)}
                    </Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Security Options</Text>
              
              {biometricsAvailable && (
                <View style={styles.switchContainer}>
                  <View style={styles.switchTextContainer}>
                    <Text style={styles.switchLabel}>
                      Use {biometryType}
                    </Text>
                    <Text style={styles.switchDescription}>
                      Require biometric authentication to access this credential
                    </Text>
                  </View>
                  <Switch
                    value={useBiometrics}
                    onValueChange={(value) => toggleSecurityOption('biometrics', value)}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={useBiometrics ? '#2196F3' : '#f4f3f4'}
                  />
                </View>
              )}
              
              {passcodeAvailable && (
                <View style={styles.switchContainer}>
                  <View style={styles.switchTextContainer}>
                    <Text style={styles.switchLabel}>
                      Use Device Passcode
                    </Text>
                    <Text style={styles.switchDescription}>
                      Require device passcode to access this credential
                    </Text>
                  </View>
                  <Switch
                    value={useDevicePasscode}
                    onValueChange={(value) => toggleSecurityOption('passcode', value)}
                    trackColor={{ false: '#767577', true: '#81b0ff' }}
                    thumbColor={useDevicePasscode ? '#2196F3' : '#f4f3f4'}
                  />
                </View>
              )}

              {!biometricsAvailable && !passcodeAvailable && (
                <Text style={styles.securityNote}>
                  No biometric or device passcode security is available on this device.
                  Set up a screen lock in your device settings to enable these features.
                </Text>
              )}
            </View>

            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>
      
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Error Details</Text>
              <TouchableOpacity 
                onPress={() => setShowErrorModal(false)}
                style={styles.closeIcon}
              >
                <Icon name="close" size={24} color="#757575" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.errorScrollView}>
              <Text style={styles.errorText}>{errorDetails}</Text>
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.copyButton]} 
                onPress={copyErrorToClipboard}
              >
                <Text style={styles.buttonText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.closeButton]} 
                onPress={() => setShowErrorModal(false)}
              >
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  innerContainer: {
    flex: 1,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F5F5F5',
  },
  errorText: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginVertical: 24,
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
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
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#757575',
    marginBottom: 6,
  },
  fieldValue: {
    fontSize: 16,
    color: '#333',
  },
  passwordContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  visibilityButton: {
    padding: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  switchTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 4,
  },
  switchDescription: {
    fontSize: 12,
    color: '#757575',
  },
  securityNote: {
    fontSize: 14,
    color: '#757575',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 16,
  },
  authButton: {
    backgroundColor: '#2196F3',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 16,
  },
  authButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: '#757575',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 24,
    alignItems: 'center',
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  errorScrollView: {
    maxHeight: 300,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    padding: 10,
  },
  errorText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#D32F2F',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  button: {
    padding: 10,
    borderRadius: 4,
    minWidth: 70,
    alignItems: 'center',
  },
  copyButton: {
    backgroundColor: '#2196F3',
    marginRight: 10,
  },
  closeButton: {
    backgroundColor: '#757575',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  closeIcon: {
    padding: 4,
  },
});

export default CredentialDetailScreen;