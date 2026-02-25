import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AuthContext from '../context/AuthContext';
import { resourceApi } from '../api';

export default function ResourcesScreen() {
  const navigation = useNavigation();
  const { user } = useContext(AuthContext);
  const [resources, setResources] = useState([]);
  const [filteredResources, setFilteredResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const loadResources = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await resourceApi.getAll({});
      const data = Array.isArray(resp.data) ? resp.data : [];
      setResources(data);
      setFilteredResources(data);
    } catch (e) {
      console.warn('Failed to load resources', e);
      setResources([]);
      setFilteredResources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const applyFilters = useCallback(() => {
    let filtered = resources;

    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.title?.toLowerCase().includes(searchLower) ||
          r.description?.toLowerCase().includes(searchLower) ||
          r.tags?.toLowerCase().includes(searchLower)
      );
    }

    if (languageFilter.trim()) {
      filtered = filtered.filter((r) => r.language?.toLowerCase() === languageFilter.toLowerCase());
    }

    if (categoryFilter.trim()) {
      filtered = filtered.filter((r) => r.category?.toLowerCase().includes(categoryFilter.toLowerCase()));
    }

    setFilteredResources(filtered);
  }, [resources, searchText, languageFilter, categoryFilter]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const getLangBadge = (lang) => {
    if (!lang) return 'EN';
    return lang.toUpperCase().substring(0, 2);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>Culturally Grounded Support</Text>
        <Text style={styles.subheader}>Curated culturally-grounded resources — searchable and filterable</Text>

        <View style={styles.filterRow}>
          <TextInput
            style={styles.input}
            placeholder="Search resources"
            placeholderTextColor="#a2a2a2"
            value={searchText}
            onChangeText={setSearchText}
          />
          <TouchableOpacity style={styles.filterButton} onPress={applyFilters}>
            <Text style={styles.filterText}>Filter</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.filterRowSmall}>
          <TextInput
            style={styles.inputSmall}
            placeholder="Language (en/rw/fr)"
            placeholderTextColor="#a2a2a2"
            value={languageFilter}
            onChangeText={setLanguageFilter}
          />
          <TextInput
            style={styles.inputSmall}
            placeholder="Category"
            placeholderTextColor="#a2a2a2"
            value={categoryFilter}
            onChangeText={setCategoryFilter}
          />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#1c86ff" style={{ marginVertical: 20 }} />
        ) : filteredResources.length === 0 ? (
          <Text style={styles.emptyText}>No resources found</Text>
        ) : (
          filteredResources.map((resource) => (
            <TouchableOpacity
              key={resource.id}
              onPress={() => navigation.navigate('ResourceDetail', { resource })}
            >
              <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarLetter}>{resource.title?.charAt(0) || 'R'}</Text>
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>{resource.title}</Text>
                  <Text style={styles.cardCulture}>{resource.category || 'Resource'} · {getLangBadge(resource.language)}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{getLangBadge(resource.language)}</Text>
                </View>
              </View>
              {resource.description && <Text style={styles.cardDescription}>{resource.description}</Text>}
              {resource.tags && (
                <View style={styles.tagRow}>
                  {resource.tags.split(',').map((tag, idx) => (
                    <View style={styles.tag} key={idx}>
                      <Text style={styles.tagText}>{tag.trim()}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.linkText}>{resource.url}</Text>
            </View>
            </TouchableOpacity>
          ))
        )}
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
    padding: 18,
    paddingBottom: 40,
  },
  header: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f1d2b',
    marginBottom: 4,
  },
  subheader: {
    fontSize: 12,
    color: '#6a6a7a',
    marginBottom: 18,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 20,
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterRowSmall: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  input: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e1e5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    marginRight: 10,
  },
  inputSmall: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e1e5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    marginRight: 10,
  },
  linkInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e1e5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  filterButton: {
    backgroundColor: '#1c86ff',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  filterText: {
    color: '#fff',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#d9e0ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4b3bff',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f1d2b',
  },
  cardCulture: {
    fontSize: 12,
    color: '#6a6a7a',
  },
  badge: {
    backgroundColor: '#dfe7ff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1b1b70',
  },
  cardDescription: {
    fontSize: 14,
    color: '#3c3c42',
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  tag: {
    backgroundColor: '#f1f1f6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6d6d7a',
  },
  linkText: {
    fontSize: 12,
    color: '#1c86ff',
  },
});