import { Platform, NativeModules } from 'react-native';
import * as Keychain from 'react-native-keychain';

class LockscreenUtils {
  /**
   * Checks if the device has lockscreen security enabled
   * @returns {Promise<boolean>} Whether lockscreen security is enabled
   */
  async isLockscreenEnabled() {
    try {
      if (Platform.OS === 'ios') {
        // For iOS, we can check if device authentication is possible
        const canAuthenticate = await Keychain.canImplyAuthentication({
          authenticationType: Keychain.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS,
        });
        return canAuthenticate;
      } else {
        // For Android, this is a best effort approach
        // We check if either biometrics or device credential is available
        const biometryType = await Keychain.getSupportedBiometryType();
        
        // If biometrics is available, device likely has screen lock
        if (biometryType) {
          return true;
        }
        
        // Otherwise we can try to see if device credentials are available
        // This is not a perfect check but gives a good indication
        const hasCredentialStore = await this._hasDeviceCredentialStore();
        return hasCredentialStore;
      }
    } catch (error) {
      console.error('Error checking lockscreen status:', error);
      return false;
    }
  }

  /**
   * Get information about available biometric authentication
   * @returns {Promise<Object>} Biometric information
   */
  async getBiometricInfo() {
    try {
      const biometryType = await Keychain.getSupportedBiometryType();
      
      return {
        available: !!biometryType,
        type: biometryType,
        displayName: this._getBiometryDisplayName(biometryType),
      };
    } catch (error) {
      console.error('Error getting biometric info:', error);
      return {
        available: false,
        type: null,
        displayName: 'Not Available',
      };
    }
  }

  /**
   * Attempts to authenticate the user using lockscreen credentials
   * @param {Object} options Authentication options
   * @returns {Promise<boolean>} Whether authentication was successful
   */
  async authenticateWithLockscreen(options = {}) {
    try {
      const {
        promptMessage = 'Authenticate to continue',
        cancelButtonText = 'Cancel',
        fallbackToPasscode = true,
      } = options;
      
      // Choose the right access control based on the fallbackToPasscode option
      let accessControl;
      if (fallbackToPasscode) {
        accessControl = Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE;
      } else {
        accessControl = Keychain.ACCESS_CONTROL.BIOMETRY_ANY;
      }
      
      // Set up security options
      const securityOptions = {
        accessControl,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
        authenticationType: Keychain.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS,
        authenticationPrompt: {
          title: promptMessage,
          description: 'Authentication is required',
          cancel: cancelButtonText,
        },
      };
      
      // For Android, also set the security level - this is CRITICAL for Android
      if (Platform.OS === 'android') {
        securityOptions.securityLevel = Keychain.SECURITY_LEVEL.SECURE_HARDWARE;
        
        // On Android, we need to explicitly set this for authentication to work
        if (fallbackToPasscode) {
          securityOptions.accessControl = Keychain.ACCESS_CONTROL.BIOMETRY_ANY_OR_DEVICE_PASSCODE;
        } else {
          // If biometrics only, check if available before setting
          const bioInfo = await this.getBiometricInfo();
          if (bioInfo.available) {
            securityOptions.accessControl = Keychain.ACCESS_CONTROL.BIOMETRY_ANY;
          } else {
            // Fall back to device passcode if biometrics aren't available
            securityOptions.accessControl = Keychain.ACCESS_CONTROL.DEVICE_PASSCODE;
          }
        }
      }
      
      // Create a temporary key in the keychain that requires authentication
      const tempKey = `auth_check_${new Date().getTime()}`;
      
      // Store a dummy value with device authentication
      await Keychain.setGenericPassword('auth_user', 'auth_check', {
        service: tempKey,
        ...securityOptions,
      });
      
      // Try to access it immediately to trigger the authentication
      const result = await Keychain.getGenericPassword({
        service: tempKey,
        ...securityOptions,
      });
      
      // Clean up the temporary value
      await Keychain.resetGenericPassword({ service: tempKey });
      
      // If we got a result, authentication succeeded
      return !!result;
    } catch (error) {
      console.error('Authentication error:', error);
      
      // Special handling for cancellation
      if (error.message && (
        error.message.includes('canceled') ||
        error.message.includes('cancelled') ||
        error.message.includes('user canceled')
      )) {
        // User canceled the auth prompt, not a real error
        return false;
      }
      
      return false;
    }
  }

  /**
   * Helper method to check if device has credential store
   * @private
   * @returns {Promise<boolean>} Whether device has credential store
   */
  async _hasDeviceCredentialStore() {
    if (Platform.OS === 'android') {
      // On Android, try to create a key that requires device credentials
      try {
        const tempKey = `credential_check_${new Date().getTime()}`;
        
        // Try to set a value with the DeviceLock security level
        await Keychain.setGenericPassword('user', 'check', {
          service: tempKey,
          securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
          accessControl: Keychain.ACCESS_CONTROL.DEVICE_PASSCODE,
          authenticationType: Keychain.AUTHENTICATION_TYPE.DEVICE_PASSCODE_OR_BIOMETRICS,
        });
        
        // Clean up
        await Keychain.resetGenericPassword({ service: tempKey });
        
        // If we got here, device has credential store
        return true;
      } catch (error) {
        // If we get an error, check the message
        if (error.message && error.message.includes('No fingerprint enrolled')) {
          // This means device has security but no fingerprints
          return true;
        }
        
        // If other error, device likely doesn't have a lock set up
        return false;
      }
    }
    
    // Default to false for other platforms
    return false;
  }

  /**
   * Helper to get a user-friendly biometry name
   * @private
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

export default new LockscreenUtils();