import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { IconSymbol } from '@/components/ui/IconSymbol';

interface Script {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  wordCount: number;
}

export default function ScriptsScreen() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    loadScripts();
  }, []);

  const loadScripts = async () => {
    try {
      const storedScripts = await AsyncStorage.getItem('teleprompter_scripts');
      if (storedScripts) {
        setScripts(JSON.parse(storedScripts));
      }
    } catch (error) {
      console.error('Error loading scripts:', error);
    }
  };

  const saveScripts = async (updatedScripts: Script[]) => {
    try {
      await AsyncStorage.setItem('teleprompter_scripts', JSON.stringify(updatedScripts));
      setScripts(updatedScripts);
    } catch (error) {
      console.error('Error saving scripts:', error);
    }
  };

  const createScript = () => {
    setEditingScript(null);
    setTitle('');
    setContent('');
    setModalVisible(true);
  };

  const editScript = (script: Script) => {
    setEditingScript(script);
    setTitle(script.title);
    setContent(script.content);
    setModalVisible(true);
  };

  const saveScript = () => {
    if (!title.trim() || !content.trim()) {
      Alert.alert('Error', 'Please enter both title and content');
      return;
    }

    const wordCount = content.trim().split(/\s+/).length;
    const now = new Date().toISOString();

    if (editingScript) {
      // Update existing script
      const updatedScripts = scripts.map(script =>
        script.id === editingScript.id
          ? { ...script, title, content, wordCount }
          : script
      );
      saveScripts(updatedScripts);
    } else {
      // Create new script
      const newScript: Script = {
        id: Date.now().toString(),
        title,
        content,
        createdAt: now,
        wordCount,
      };
      saveScripts([...scripts, newScript]);
    }

    setModalVisible(false);
    setTitle('');
    setContent('');
    setEditingScript(null);
  };

  const deleteScript = (scriptId: string) => {
    Alert.alert(
      'Delete Script',
      'Are you sure you want to delete this script?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedScripts = scripts.filter(script => script.id !== scriptId);
            saveScripts(updatedScripts);
          },
        },
      ]
    );
  };

  const selectScript = async (script: Script) => {
    try {
      await AsyncStorage.setItem('selected_script', JSON.stringify(script));
      Alert.alert('Script Selected', `"${script.title}" is now ready for teleprompter use.`);
    } catch (error) {
      console.error('Error selecting script:', error);
    }
  };

  const renderScript = ({ item }: { item: Script }) => (
    <ThemedView style={styles.scriptItem}>
      <TouchableOpacity
        style={styles.scriptContent}
        onPress={() => selectScript(item)}
      >
        <ThemedText style={styles.scriptTitle}>{item.title}</ThemedText>
        <ThemedText style={styles.scriptMeta}>
          {item.wordCount} words • {new Date(item.createdAt).toLocaleDateString()}
        </ThemedText>
        <ThemedText style={styles.scriptPreview} numberOfLines={2}>
          {item.content}
        </ThemedText>
      </TouchableOpacity>
      <View style={styles.scriptActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => editScript(item)}
        >
          <IconSymbol name="pencil" size={20} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => deleteScript(item.id)}
        >
          <IconSymbol name="trash" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText style={styles.headerTitle}>Scripts</ThemedText>
        <TouchableOpacity style={styles.addButton} onPress={createScript}>
          <Image
            source={require('@/assets/images/plus.svg')}
            style={styles.plusIcon}
            contentFit="contain"
          />
        </TouchableOpacity>
      </View>

      {scripts.length === 0 ? (
        <View style={styles.emptyState}>
          <IconSymbol name="doc.text" size={64} color="#999" />
          <ThemedText style={styles.emptyText}>No scripts yet</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Create your first script to get started
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={scripts}
          renderItem={renderScript}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
        />
      )}

      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <ThemedView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <ThemedText style={styles.cancelButton}>Cancel</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.modalTitle}>
              {editingScript ? 'Edit Script' : 'New Script'}
            </ThemedText>
            <TouchableOpacity onPress={saveScript}>
              <ThemedText style={styles.saveButton}>Save</ThemedText>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <ThemedText style={styles.inputLabel}>Title</ThemedText>
            <TextInput
              style={styles.titleInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter script title"
              placeholderTextColor="#999"
            />

            <ThemedText style={styles.inputLabel}>Content</ThemedText>
            <TextInput
              style={styles.contentInput}
              value={content}
              onChangeText={setContent}
              placeholder="Enter your script content here..."
              placeholderTextColor="#999"
              multiline
              textAlignVertical="top"
            />

            {content.trim() && (
              <ThemedText style={styles.wordCount}>
                Word count: {content.trim().split(/\s+/).length}
              </ThemedText>
            )}
          </ScrollView>
        </ThemedView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 70,
    paddingBottom: 25,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    padding:5,
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  plusIcon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 20,
    color: '#999',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  listContainer: {
    padding: 20,
  },
  scriptItem: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  scriptContent: {
    flex: 1,
    padding: 16,
  },
  scriptTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  scriptMeta: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  scriptPreview: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  scriptActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  contentInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    minHeight: 200,
  },
  wordCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'right',
  },
});
