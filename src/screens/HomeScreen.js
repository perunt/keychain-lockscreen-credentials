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
      // Reload items when screen comes into focus
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
                const success = await StorageService.updateCredential(
                  itemKey,
                  username,
                  password,
                  {
                    useBiometrics,
                    useDevicePasscode,
                  }
                );
                
                setLoading(false);
                
                if (success) {
                  Alert.alert('Success', 'Credential updated successfully');
                  clearForm();
                  loadItems();
                } else {
                  Alert.alert('Error', 'Failed to update credential');
                }
              },
            },
          ],
          { cancelable: false }
        );
        return;
      }
      
      // Save new credential
      const success = await StorageService.saveCredential(
        itemKey,
        username,
        password,
        {
          useBiometrics,
          useDevicePasscode,
        }
      );
      
      setLoading(false);
      
      if (success) {
        Alert.alert('Success', 'Credential saved successfully');
        clearForm();
        loadItems();
      } else {
        Alert.alert('Error', 'Failed to save credential');
      }
    } catch (error) {
      setLoading(false);
      console.error('Error saving credential:', error);
      Alert.alert('Error', 'Failed to save credential');
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
});

export default HomeScreen;