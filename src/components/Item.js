import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert, Clipboard, Modal, ScrollView, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import StorageService from '../services/StorageService';

const Item = ({ itemKey, onItemPressed, onItemDeleted, securityOptions }) => {
  const [metadata, setMetadata] = useState({
    createdAt: null,
    updatedAt: null,
  });
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

  React.useEffect(() => {
    const metadataStr = StorageService.storage.getString(`metadata_${itemKey}`);
    if (metadataStr) {
      try {
        setMetadata(JSON.parse(metadataStr));
      } catch (error) {
        console.error('Error parsing metadata:', error);
      }
    }
  }, [itemKey]);

  const handlePress = async () => {
    try {
      onItemPressed(itemKey);
    } catch (error) {
      console.error('Error getting credential:', error);
      Alert.alert('Error', 'Failed to access this credential');
    }
  };

  const copyErrorToClipboard = () => {
    if (errorDetails) {
      Clipboard.setString(errorDetails);
      Alert.alert('Copied', 'Error details copied to clipboard');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this credential?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await StorageService.deleteCredential(itemKey);
              if (result.success) {
                onItemDeleted(itemKey);
              } else {
                const errorJson = JSON.stringify(result.error, Object.getOwnPropertyNames(result.error));
                setErrorDetails(errorJson);
                Alert.alert(
                  'Error', 
                  'Failed to delete credential: ' + (result.error?.message || 'Unknown error'),
                  [
                    { text: 'OK' },
                    { text: 'Show Details', onPress: () => setShowErrorModal(true) }
                  ]
                );
              }
            } catch (error) {
              console.error('Error deleting credential:', error);
              const errorJson = JSON.stringify(error, Object.getOwnPropertyNames(error));
              setErrorDetails(errorJson);
              Alert.alert(
                'Error', 
                'Failed to delete credential: ' + error.message,
                [
                  { text: 'OK' },
                  { text: 'Show Details', onPress: () => setShowErrorModal(true) }
                ]
              );
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <>
      <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
        <View style={styles.iconContainer}>
          <Icon name="lock" size={24} color="#2196F3" />
        </View>
        <View style={styles.content}>
          <Text style={styles.title}>{itemKey}</Text>
          <Text style={styles.subtitle}>
            Created: {formatDate(metadata.createdAt)}
          </Text>
          {metadata.updatedAt !== metadata.createdAt && (
            <Text style={styles.subtitle}>
              Updated: {formatDate(metadata.updatedAt)}
            </Text>
          )}
        </View>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Icon name="delete" size={24} color="#FF5252" />
        </TouchableOpacity>
      </TouchableOpacity>

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
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 8,
    marginVertical: 6,
    marginHorizontal: 16,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#757575',
  },
  deleteButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
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
});

export default Item;