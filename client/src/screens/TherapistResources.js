import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AuthContext from '../context/AuthContext';
import { resourceApi } from '../api';

export default function TherapistResourcesScreen() {
  const { user } = useContext(AuthContext);
  const therapistId = user?.therapist_id || user?.id;
  const navigation = useNavigation();

  const [tab, setTab] = useState('create'); // 'create' or 'view'
  const [resources, setResources] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  // Create form states
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [language, setLanguage] = useState('en');
  const [tags, setTags] = useState('');
  const [creating, setCreating] = useState(false);

  const loadMyResources = useCallback(async () => {
    if (!therapistId) return;
    setLoadingResources(true);
    try {
      const resp = await resourceApi.getAll({ created_by: therapistId });
      const data = Array.isArray(resp.data) ? resp.data : [];
      setResources(data);
    } catch (e) {
      console.warn('Failed to load resources', e);
      setResources([]);
    } finally {
      setLoadingResources(false);
    }
  }, [therapistId]);

  useEffect(() => {
    if (tab === 'view') {
      loadMyResources();
    }
  }, [tab, loadMyResources]);

  const handleCreateResource = async () => {
    if (!title.trim() || !category.trim() || !url.trim()) {
      Alert.alert('Error', 'Title, category, and URL are required');
      return;
    }

    setCreating(true);
    try {
      await resourceApi.create({
        title,
        category,
        description,
        url,
        language,
        tags,
        created_by: therapistId,
      });
      Alert.alert('Success', 'Resource created successfully');
      setTitle('');
      setCategory('');
      setDescription('');
      setUrl('');
      setLanguage('en');
      setTags('');
      setTab('view');
      loadMyResources();
    } catch (e) {
      console.warn('Failed to create resource', e);
      Alert.alert('Error', 'Failed to create resource');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tabButton, tab === 'create' && styles.tabButtonActive]}
              onPress={() => setTab('create')}
            >
              <Text style={[styles.tabText, tab === 'create' && styles.tabTextActive]}>
                Create Resource
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, tab === 'view' && styles.tabButtonActive]}
              onPress={() => setTab('view')}
            >
              <Text style={[styles.tabText, tab === 'view' && styles.tabTextActive]}>
                My Resources
              </Text>
            </TouchableOpacity>
          </View>

          {tab === 'create' ? (
            <>
              <Text style={styles.heading}>Create a New Resource</Text>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Title *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Mindfulness Guide"
                  value={title}
                  onChangeText={setTitle}
                  placeholderTextColor="#aaa"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Category *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. meditation, wellness, mental-health"
                  value={category}
                  onChangeText={setCategory}
                  placeholderTextColor="#aaa"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder="Describe the resource..."
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  placeholderTextColor="#aaa"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>URL/Link *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://example.com/resource"
                  value={url}
                  onChangeText={setUrl}
                  placeholderTextColor="#aaa"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Language</Text>
                <TextInput
                  style={styles.input}
                  placeholder="en, rw, fr"
                  value={language}
                  onChangeText={setLanguage}
                  placeholderTextColor="#aaa"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Tags (comma-separated)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. wellness, meditation, cultural"
                  value={tags}
                  onChangeText={setTags}
                  placeholderTextColor="#aaa"
                />
              </View>

              <TouchableOpacity
                style={[styles.button, creating && styles.buttonDisabled]}
                onPress={handleCreateResource}
                disabled={creating}
              >
                <Text style={styles.buttonText}>{creating ? 'Creating...' : 'Create Resource'}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.heading}>My Resources</Text>

              {loadingResources ? (
                <ActivityIndicator size="large" color="#007AFF" />
              ) : resources.length === 0 ? (
                <Text style={styles.emptyText}>No resources created yet. Create one to get started!</Text>
              ) : (
                resources.map((resource) => (
                  <View style={styles.resourceCard} key={resource.id}>
                    <Text style={styles.resourceTitle}>{resource.title}</Text>
                    <Text style={styles.resourceCategory}>{resource.category}</Text>
                    {resource.description && (
                      <Text style={styles.resourceDescription}>{resource.description}</Text>
                    )}
                    {resource.tags && (
                      <View style={styles.tagRow}>
                        {resource.tags.split(',').map((tag, idx) => (
                          <Text key={idx} style={styles.tag}>
                            {tag.trim()}
                          </Text>
                        ))}
                      </View>
                    )}
                    <Text style={styles.resourceUrl}>{resource.url}</Text>
                  </View>
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scroll: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  tabButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
  },
  tabButtonActive: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#f9f9f9',
  },
  multiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  button: {
    marginTop: 16,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 20,
  },
  resourceCard: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
  },
  resourceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  resourceCategory: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
  },
  resourceDescription: {
    fontSize: 13,
    color: '#555',
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    backgroundColor: '#e0e7ff',
    color: '#0052cc',
    fontSize: 11,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  resourceUrl: {
    fontSize: 11,
    color: '#007AFF',
    marginTop: 4,
  },
});