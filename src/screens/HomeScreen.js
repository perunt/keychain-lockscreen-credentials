import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Switch,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Clipboard,
  Modal,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Item from '../components/Item';
import StorageService from '../services/StorageService';

const HomeScreen = ({ navigation }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [itemKey, setItemKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [passcodeAvailable, setPasscodeAvailable] = useState(false);
  const [useBiometrics, setUseBiometrics] = useState(false);
  const [useDevicePasscode, setUseDevicePasscode] = useState(false);
  const [biometryType, setBiometryType] = useState('None');
  const [expandSecurityOptions, setExpandSecurityOptions] = useState(false);
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successDetails, setSuccessDetails] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [notificationInfo, setNotificationInfo] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const insets = useSafeAreaInsets();
  const usernameInputRef = useRef(null);
  const passwordInputRef = useRef(null);

  useEffect(() => {
    const checkSecurity = async () => {
      const bioResult = await StorageService.checkBiometricAvailability();
      setBiometricsAvailable(bioResult.available);
      setBiometryType(bioResult.displayName);

      const passcodeResult = await StorageService.checkDevicePasscodeAvailability();
      setPasscodeAvailable(passcodeResult);
    };

    const unsubscribe = navigation.addListener('focus', () => {
      loadItems();
    });

    checkSecurity();
    loadItems();

    return unsubscribe;
  }, [navigation]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const itemsList = await StorageService.getItemsList();
      setItems(itemsList);
    } catch (error) {
      console.error('Error loading items:', error);
      Alert.alert('Error', 'Failed to load saved credentials');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadItems();
  };

  const handleItemPress = (key) => {
    navigation.navigate('CredentialDetail', { itemKey: key });
  };

  const handleItemDeleted = () => {
    // Reload the list after deletion
    loadItems();
  };

  const navigateToSettings = () => {
    navigation.navigate('Settings');
  };

  const validateInput = () => {
    if (!itemKey.trim()) {
      Alert.alert('Error', 'Please enter a name for this credential');
      return false;
    }
    
    if (!username.trim()) {
      Alert.alert('Error', 'Please enter a username');
      return false;
    }
    
    if (!password.trim()) {
      Alert.alert('Error', 'Please enter a password or value');
      return false;
    }
    
    return true;
  };

  const fadeIn = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const fadeOut = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowSuccessNotification(false);
    });
  };

  const showNotification = (operation, securityInfo) => {
    setNotificationInfo({
      operation,
      securityInfo
    });
    
    console.log('Showing notification with security info:', securityInfo);
    
    setShowSuccessNotification(false);
    
    setTimeout(() => {
      setShowSuccessNotification(true);
      
      fadeIn();
      
      setTimeout(() => {
        fadeOut();
      }, 20000);
    }, 100);
  };

  const handleSave = async () => {
    if (!validateInput()) {
      return;
    }

    try {
      setLoading(true);
      
      // Check if item key already exists
      const itemsList = await StorageService.getItemsList();
      if (itemsList.includes(itemKey)) {
        Alert.alert(
          'Credential Exists',
          'A credential with this name already exists. Do you want to update it?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setLoading(false),
            },
            {
              text: 'Update',
              onPress: async () => {
                try {
                  const result = await StorageService.updateCredential(
                    itemKey,
                    username,
                    password,
                    {
                      useBiometrics,
                      useDevicePasscode,
                    }
                  );
                  
                  setLoading(false);
                  
                  if (result.success) {
                    const securityInfo = result.securityInfo || {};
                    console.log('Security info from update:', securityInfo);
                    
                    setSuccessDetails({
                      operation: 'Update',
                      credential: {
                        key: itemKey,
                        username,
                        securityInfo
                      }
                    });
                    
                    showNotification('Update', {
                      accessControl: securityInfo.accessControlName || 'None',
                      accessible: securityInfo.accessibleName || 'Default',
                      securityLevel: securityInfo.securityLevelName || 'Default',
                      biometrics: useBiometrics ? 'Yes' : 'No',
                      devicePasscode: useDevicePasscode ? 'Yes' : 'No'
                    });
                    
                    Alert.alert('Success', 'Credential updated successfully');
                    
                    clearForm();
                    loadItems();
                  } else {
                    const errorJson = JSON.stringify(result.error, Object.getOwnPropertyNames(result.error));
                    setErrorDetails(errorJson);
                    Alert.alert(
                      'Error', 
                      'Failed to update credential: ' + (result.error?.message || 'Unknown error'), 
                      [
                        { text: 'OK' },
                        { text: 'Show Details', onPress: () => setShowErrorModal(true) }
                      ]
                    );
                  }
                } catch (error) {
                  setLoading(false);
                  console.error('Error updating credential:', error);
                  const errorJson = JSON.stringify(error, Object.getOwnPropertyNames(error));
                  setErrorDetails(errorJson);
                  Alert.alert(
                    'Error', 
                    'Failed to update credential: ' + error.message,
                    [
                      { text: 'OK' },
                      { text: 'Show Details', onPress: () => setShowErrorModal(true) }
                    ]
                  );
                }
              },
            },
          ],
          { cancelable: false }
        );
        return;
      }
      
      // Save new credential
      const result = await StorageService.saveCredential(
        itemKey,
        username,
        password,
        {
          useBiometrics,
          useDevicePasscode,
        }
      );
      
      setLoading(false);
      
      if (result.success) {
        const securityInfo = result.securityInfo || {};
        console.log('Security info from save:', securityInfo);

        setSuccessDetails({
          operation: 'Create',
          credential: {
            key: itemKey,
            username,
            securityInfo
          }
        });
        
        showNotification('Create', {
          accessControl: securityInfo.accessControlName || 'None',
          accessible: securityInfo.accessibleName || 'Default',
          securityLevel: securityInfo.securityLevelName || 'Default',
          biometrics: useBiometrics ? 'Yes' : 'No',
          devicePasscode: useDevicePasscode ? 'Yes' : 'No'
        });
        
        Alert.alert('Success', 'Credential saved successfully');
        
        clearForm();
        loadItems();
      } else {
        const errorJson = JSON.stringify(result.error, Object.getOwnPropertyNames(result.error));
        setErrorDetails(errorJson);
        Alert.alert(
          'Error', 
          'Failed to save credential: ' + (result.error?.message || 'Unknown error'),
          [
            { text: 'OK' },
            { text: 'Show Details', onPress: () => setShowErrorModal(true) }
          ]
        );
      }
    } catch (error) {
      setLoading(false);
      console.error('Error saving credential:', error);
      const errorJson = JSON.stringify(error, Object.getOwnPropertyNames(error));
      setErrorDetails(errorJson);
      Alert.alert(
        'Error', 
        'Failed to save credential: ' + error.message,
        [
          { text: 'OK' },
          { text: 'Show Details', onPress: () => setShowErrorModal(true) }
        ]
      );
    }
  };

  const copyErrorToClipboard = () => {
    if (errorDetails) {
      Clipboard.setString(errorDetails);
      Alert.alert('Copied', 'Error details copied to clipboard');
    }
  };

  const clearForm = () => {
    setItemKey('');
    setUsername('');
    setPassword('');
    setUseBiometrics(false);
    setUseDevicePasscode(false);
    setExpandSecurityOptions(false);
  };

  const toggleSecurityOptions = () => {
    setExpandSecurityOptions(!expandSecurityOptions);
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Icon name="lock-outline" size={64} color="#BDBDBD" />
      <Text style={styles.emptyText}>No saved credentials</Text>
      <Text style={styles.emptySubtext}>
        Add a new credential using the form below
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {/* Success notification positioned at the top level for visibility */}
      {showSuccessNotification && notificationInfo && (
        <Animated.View style={[styles.notificationContainer, { opacity: fadeAnim }]}>
          <View style={styles.notificationHeader}>
            <Text style={styles.notificationTitle}>
              Credential {notificationInfo.operation}d Successfully
            </Text>
            <TouchableOpacity 
              onPress={fadeOut}
              style={styles.closeIcon}
            >
              <Icon name="close" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.notificationContent}>
            <Text style={styles.notificationSubtitle}>Security Details:</Text>
            <View style={styles.securityDetail}>
              <Text style={styles.securityLabel}>Access Control:</Text>
              <Text style={styles.securityValue}>
                {notificationInfo.securityInfo.accessControl}
              </Text>
            </View>
            <View style={styles.securityDetail}>
              <Text style={styles.securityLabel}>Accessible:</Text>
              <Text style={styles.securityValue}>
                {notificationInfo.securityInfo.accessible}
              </Text>
            </View>
            <View style={styles.securityDetail}>
              <Text style={styles.securityLabel}>Security Level:</Text>
              <Text style={styles.securityValue}>
                {notificationInfo.securityInfo.securityLevel}
              </Text>
            </View>
            <View style={styles.securityDetail}>
              <Text style={styles.securityLabel}>Using Biometrics:</Text>
              <Text style={styles.securityValue}>
                {notificationInfo.securityInfo.biometrics}
              </Text>
            </View>
            <View style={styles.securityDetail}>
              <Text style={styles.securityLabel}>Using Device Passcode:</Text>
              <Text style={styles.securityValue}>
                {notificationInfo.securityInfo.devicePasscode}
              </Text>
            </View>
            
            <TouchableOpacity 
              style={styles.moreDetailsButton}
              onPress={() => setShowSuccessModal(true)}
            >
              <Text style={styles.moreDetailsText}>See More Details</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>LockscreenCredentialsExample</Text>
            <TouchableOpacity 
              style={styles.settingsButton} 
              onPress={navigateToSettings}
            >
              <Icon name="settings" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={styles.loadingText}>Loading credentials...</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              renderItem={({ item }) => (
                <Item
                  itemKey={item}
                  onItemPressed={handleItemPress}
                  onItemDeleted={handleItemDeleted}
                />
              )}
              keyExtractor={(item) => item}
              contentContainerStyle={styles.listContent}
              refreshing={refreshing}
              onRefresh={handleRefresh}
              ListEmptyComponent={renderEmptyList}
            />
          )}

          <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
            <Text style={styles.formTitle}>Add New Credential</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Credential Name"
              value={itemKey}
              onChangeText={setItemKey}
              returnKeyType="next"
              onSubmitEditing={() => usernameInputRef.current?.focus()}
            />
            
            <TextInput
              ref={usernameInputRef}
              style={styles.input}
              placeholder="Username"
              value={username}
              onChangeText={setUsername}
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />
            
            <TextInput
              ref={passwordInputRef}
              style={styles.input}
              placeholder="Password/Value"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
            />
            
            <TouchableOpacity
              style={styles.securityOptionsButton}
              onPress={toggleSecurityOptions}
            >
              <Text style={styles.securityOptionsText}>
                {expandSecurityOptions ? 'Hide' : 'Show'} Security Options
              </Text>
              <Icon
                name={expandSecurityOptions ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                size={24}
                color="#2196F3"
              />
            </TouchableOpacity>
            
            {expandSecurityOptions && (
              <View style={styles.securityOptionsContainer}>
                {biometricsAvailable && (
                  <View style={styles.switchContainer}>
                    <View style={styles.switchTextContainer}>
                      <Text style={styles.switchLabel}>
                        Use {biometryType}
                      </Text>
                      <Text style={styles.switchDescription}>
                        Require your device's {biometryType} to access this credential
                      </Text>
                    </View>
                    <Switch
                      value={useBiometrics}
                      onValueChange={(value) => {
                        setUseBiometrics(value);
                        if (value) setUseDevicePasscode(false);
                      }}
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
                        Require your device's PIN, pattern, or password to access this credential
                      </Text>
                    </View>
                    <Switch
                      value={useDevicePasscode}
                      onValueChange={(value) => {
                        setUseDevicePasscode(value);
                        if (value) setUseBiometrics(false);
                      }}
                      trackColor={{ false: '#767577', true: '#81b0ff' }}
                      thumbColor={useDevicePasscode ? '#2196F3' : '#f4f3f4'}
                    />
                  </View>
                )}
                
                {!biometricsAvailable && !passcodeAvailable && (
                  <Text style={styles.securityNote}>
                    No biometric or device passcode security is available.
                    Set up a screen lock in your device settings to enable these features.
                  </Text>
                )}
                
                {(biometricsAvailable || passcodeAvailable) && (
                  <Text style={styles.securityNote}>
                    Note: Using the device's security features provides stronger protection 
                    than custom passwords. Your credentials will be secured by the same 
                    technology that locks your device.
                  </Text>
                )}
              </View>
            )}
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={clearForm}
              >
                <Text style={styles.cancelButtonText}>Clear</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      {/* Error Modal */}
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
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.closeButton]} 
                onPress={() => setShowErrorModal(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Success Details Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Security Details
              </Text>
              <TouchableOpacity 
                onPress={() => setShowSuccessModal(false)}
                style={styles.closeIcon}
              >
                <Icon name="close" size={24} color="#757575" />
              </TouchableOpacity>
            </View>
            {successDetails && (
              <ScrollView style={styles.successScrollView}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailTitle}>Credential Information</Text>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Operation:</Text>
                    <Text style={styles.detailValue}>{successDetails.operation}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Name:</Text>
                    <Text style={styles.detailValue}>{successDetails.credential.key}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Username:</Text>
                    <Text style={styles.detailValue}>{successDetails.credential.username}</Text>
                  </View>
                </View>
                
                <View style={styles.detailSection}>
                  <Text style={styles.detailTitle}>Security Configuration</Text>
                  {successDetails.credential.securityInfo && (
                    <>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Access Control:</Text>
                        <Text style={styles.detailValue}>
                          {successDetails.credential.securityInfo.accessControlName}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Accessible:</Text>
                        <Text style={styles.detailValue}>
                          {successDetails.credential.securityInfo.accessibleName}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Security Level:</Text>
                        <Text style={styles.detailValue}>
                          {successDetails.credential.securityInfo.securityLevelName}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Authentication Required:</Text>
                        <Text style={styles.detailValue}>
                          {successDetails.credential.securityInfo.authenticationRequired ? 'Yes' : 'No'}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Using Biometrics:</Text>
                        <Text style={styles.detailValue}>
                          {successDetails.credential.securityInfo.isUsingBiometrics ? 'Yes' : 'No'}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Using Device Passcode:</Text>
                        <Text style={styles.detailValue}>
                          {successDetails.credential.securityInfo.isUsingDevicePasscode ? 'Yes' : 'No'}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              </ScrollView>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.button, styles.closeButton]} 
                onPress={() => setShowSuccessModal(false)}
              >
                <Text style={styles.closeButtonText}>Close</Text>
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
  header: {
    backgroundColor: '#2196F3',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  settingsButton: {
    padding: 8,
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
  listContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#757575',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9E9E9E',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  formContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: Platform.OS === 'ios' ? 420 : 450,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#F9F9F9',
  },
  securityOptionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 12,
  },
  securityOptionsText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  securityOptionsContainer: {
    marginBottom: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
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
    marginVertical: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
  },
  saveButton: {
    backgroundColor: '#2196F3',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cancelButtonText: {
    color: '#757575',
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
  copyButton: {
    backgroundColor: '#2196F3',
    marginRight: 10,
  },
  copyButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#757575',
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  closeIcon: {
    padding: 4,
  },
  successScrollView: {
    maxHeight: 400,
    marginBottom: 15,
  },
  detailSection: {
    marginBottom: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 15,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555',
    width: '45%',
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  notificationContainer: {
    position: 'absolute',
    top: 0, 
    left: 0,
    right: 0,
    backgroundColor: '#4CAF50',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    zIndex: 9999,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.5)',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  notificationTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  notificationContent: {
    padding: 16,
    paddingBottom: 20,
  },
  notificationSubtitle: {
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  securityDetail: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  securityLabel: {
    color: 'rgba(255,255,255,0.9)',
    fontWeight: 'bold',
    width: '50%',
  },
  securityValue: {
    color: 'white',
    flex: 1,
  },
  moreDetailsButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
  },
  moreDetailsText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default HomeScreen;