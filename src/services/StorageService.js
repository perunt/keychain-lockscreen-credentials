import * as Keychain from 'react-native-keychain';
import { MMKV } from 'react-native-mmkv';
import { Platform, NativeModules } from 'react-native';

const storage = new MMKV({
  id: 'app-storage',
  encryptionKey: 'secure-app-storage-key'
});

// Service identifier for keychain
const SERVICE = 'com.lockscreencreds.example';

class StorageService {
  constructor() {
    // Make storage accessible directly for simpler access
    this.storage = storage;
  }

  /**
   * Get list of all saved items from MMKV storage
   * @returns {Array} Array of item identifiers
   */
  getItemsList() {
    const itemsList = storage.getString('itemsList');
    return itemsList ? JSON.parse(itemsList) : [];
  }

  /**
   * Save an updated list of items to MMKV
   * @param {Array} items Array of item identifiers 
   */
  saveItemsList(items) {
    storage.set('itemsList', JSON.stringify(items));
  }

  /**
   * Add a new credential to keychain and update the items list
   * @param {String} key Identifier for the credential
   * @param {String} username Username to store
   * @param {String} password Password or value to store
   * @param {Object} options Additional options (useBiometrics, etc)
   * @returns {Promise<Boolean>} Success status
   */
  async saveCredential(key, username, password, options = {}) {
    try {
      const { useBiometrics = false, useDevicePasscode = false } = options;
      let accessControl = null;
      let securityLevel = null;
      let androidAuthenticationRequired = false;

      // Configure security options based on platform and user preferences
      if (useBiometrics && useDevicePasscode) {
        // If both are selected, prefer the combination
        accessControl = Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE;
        androidAuthenticationRequired = true;
      } else if (useBiometrics) {
        // Biometrics only
        accessControl = Keychain.ACCESS_CONTROL.BIOMETRY_ANY;
        androidAuthenticationRequired = true;
      } else if (useDevicePasscode) {
        // Device passcode only
        accessControl = Keychain.ACCESS_CONTROL.DEVICE_PASSCODE;
        androidAuthenticationRequired = true;
      }
      
      // Set security level and platform-specific options
      if (Platform.OS === 'android' && (useBiometrics || useDevicePasscode)) {
        securityLevel = Keychain.SECURITY_LEVEL.SECURE_HARDWARE;
        // This is crucial for Android to require authentication
        if (!accessControl) {
          accessControl = Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE;
        }
      } else if (accessControl) {
        // For iOS or if any security is enabled
        securityLevel = Keychain.SECURITY_LEVEL.SECURE_SOFTWARE;
      }

      // Set keychain options
      const keychainOptions = {
        service: `${SERVICE}.${key}`,
        accessControl,
        securityLevel,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
      };

      // Android-specific: explicitly set authentication required
      if (Platform.OS === 'android' && androidAuthenticationRequired) {
        keychainOptions.authenticationPrompt = {
          title: 'Authentication Required',
          description: 'Please authenticate to access this credential',
        };
        // Essential for Android to enforce authentication
        keychainOptions.authenticationType = Keychain.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS;
      }

      // Add current timestamp to metadata
      const metadata = {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        key,
        useBiometrics,
        useDevicePasscode
      };
      
      // Store metadata in MMKV
      storage.set(`metadata_${key}`, JSON.stringify(metadata));
      
      // Store credential in keychain
      await Keychain.setGenericPassword(username, password, keychainOptions);
      
      // Update items list
      const currentItems = this.getItemsList();
      if (!currentItems.includes(key)) {
        currentItems.push(key);
        this.saveItemsList(currentItems);
      }
      
      return true;
    } catch (error) {
      console.error('Error saving credential:', error);
      return false;
    }
  }

  /**
   * Retrieve credential from keychain
   * @param {String} key Identifier for the credential
   * @param {Object} options Additional options (useBiometrics, promptMessage)
   * @returns {Promise<Object|null>} Credential object or null
   */
  async getCredential(key, options = {}) {
    try {
      const { useBiometrics = false, promptMessage = 'Authenticate to access credential' } = options;
      
      // Get metadata to check security settings
      const metadataStr = storage.getString(`metadata_${key}`);
      const metadata = metadataStr ? JSON.parse(metadataStr) : {};
      const requiresAuth = metadata.useBiometrics || metadata.useDevicePasscode;
      
      const keychainOptions = {
        service: `${SERVICE}.${key}`,
      };
      
      // Add authentication prompt if credential requires it or if explicitly requested
      if (requiresAuth || useBiometrics) {
        keychainOptions.authenticationPrompt = {
          title: promptMessage,
          description: 'Authentication is required to access this credential',
          cancel: 'Cancel'
        };
        
        // For Android, we need to specify the authentication type and security level
        if (Platform.OS === 'android') {
          keychainOptions.authenticationType = Keychain.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS;
          keychainOptions.accessControl = metadata.useBiometrics ? 
            Keychain.ACCESS_CONTROL.BIOMETRY_ANY : 
            Keychain.ACCESS_CONTROL.DEVICE_PASSCODE;
          keychainOptions.securityLevel = Keychain.SECURITY_LEVEL.SECURE_HARDWARE;
        }
      }
      
      // Get credential from keychain
      const credential = await Keychain.getGenericPassword(keychainOptions);
      
      if (credential) {
        return {
          ...credential,
          metadata,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error retrieving credential:', error);
      
      // If error indicates authentication is needed, return null
      // The UI can then prompt for authentication explicitly
      if (error.message && (
        error.message.includes('authentication required') ||
        error.message.includes('user not authenticated') ||
        error.message.includes('cancelled') ||
        error.message.includes('canceled')
      )) {
        return null;
      }
      
      return null;
    }
  }

  /**
   * Delete a credential from keychain
   * @param {String} key Identifier for the credential
   * @returns {Promise<Boolean>} Success status
   */
  async deleteCredential(key) {
    try {
      // Remove from keychain
      await Keychain.resetGenericPassword({
        service: `${SERVICE}.${key}`,
      });
      
      // Delete metadata from MMKV
      storage.delete(`metadata_${key}`);
      
      // Update items list
      const currentItems = this.getItemsList();
      const updatedItems = currentItems.filter(item => item !== key);
      this.saveItemsList(updatedItems);
      
      return true;
    } catch (error) {
      console.error('Error deleting credential:', error);
      return false;
    }
  }

  /**
   * Update an existing credential
   * @param {String} key Identifier for the credential
   * @param {String} username New username
   * @param {String} password New password/value
   * @param {Object} options Additional options
   * @returns {Promise<Boolean>} Success status
   */
  async updateCredential(key, username, password, options = {}) {
    try {
      // Get existing metadata
      const metadataStr = storage.getString(`metadata_${key}`);
      const metadata = metadataStr ? JSON.parse(metadataStr) : { createdAt: new Date().toISOString() };
      
      // Update metadata
      metadata.updatedAt = new Date().toISOString();
      metadata.useBiometrics = options.useBiometrics || false;
      metadata.useDevicePasscode = options.useDevicePasscode || false;
      
      storage.set(`metadata_${key}`, JSON.stringify(metadata));
      
      // Update credential in keychain (reusing the save method)
      return await this.saveCredential(key, username, password, options);
    } catch (error) {
      console.error('Error updating credential:', error);
      return false;
    }
  }

  /**
   * Check if biometric authentication is available
   * @returns {Promise<Object>} Biometric availability info
   */
  async checkBiometricAvailability() {
    try {
      const biometryType = await Keychain.getSupportedBiometryType();
      
      return {
        available: !!biometryType,
        biometryType,
        displayName: this._getBiometryDisplayName(biometryType),
      };
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return {
        available: false,
        biometryType: null,
        displayName: 'Not Available',
      };
    }
  }

  /**
   * Check if device has a passcode/pin set
   * @returns {Promise<Boolean>} Whether device has passcode
   */
  async checkDevicePasscodeAvailability() {
    try {
      if (Platform.OS === 'ios') {
        const result = await Keychain.canImplyAuthentication({
          authenticationType: Keychain.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS,
        });
        return result;
      } else {
        // For Android, this is a best effort approach
        // We check if either biometrics or device credential is available
        const biometryType = await Keychain.getSupportedBiometryType();
        
        // If biometrics is available, device likely has screen lock
        if (biometryType) {
          return true;
        }
        
        // Otherwise we can try to see if device credentials are available
        try {
          // Test if we can create a key that requires device credentials
          const testKey = `test_passcode_${new Date().getTime()}`;
          await Keychain.setGenericPassword('test', 'test', {
            service: testKey,
            accessControl: Keychain.ACCESS_CONTROL.DEVICE_PASSCODE,
            securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
          });
          
          // If successful, clean up and return true
          await Keychain.resetGenericPassword({ service: testKey });
          return true;
        } catch (e) {
          console.log('Device passcode not available:', e);
          return false;
        }
      }
    } catch (error) {
      console.error('Error checking device passcode:', error);
      return false;
    }
  }

  /**
   * Helper to get a user-friendly biometry name
   * @param {String} biometryType The biometry type from Keychain
   * @returns {String} User-friendly name
   */
  _getBiometryDisplayName(biometryType) {
    if (!biometryType) {
      return 'Not Available';
    }
    
    if (Platform.OS === 'ios') {
      switch (biometryType) {
        case Keychain.BIOMETRY_TYPE.FACE_ID:
          return 'Face ID';
        case Keychain.BIOMETRY_TYPE.TOUCH_ID:
          return 'Touch ID';
        case Keychain.BIOMETRY_TYPE.OPTIC_ID:
          return 'Optic ID';
        default:
          return 'Biometrics';
      }
    } else {
      // Android just returns a generic 'Biometrics' type
      return 'Fingerprint / Biometrics';
    }
  }
}

export default new StorageService();