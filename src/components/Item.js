import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import StorageService from '../services/StorageService';

const Item = ({ itemKey, onItemPressed, onItemDeleted, securityOptions }) => {
  const [metadata, setMetadata] = React.useState({
    createdAt: null,
    updatedAt: null,
  });

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
              const success = await StorageService.deleteCredential(itemKey);
              if (success) {
                onItemDeleted(itemKey);
              } else {
                Alert.alert('Error', 'Failed to delete credential');
              }
            } catch (error) {
              console.error('Error deleting credential:', error);
              Alert.alert('Error', 'Failed to delete credential');
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
});

export default Item;