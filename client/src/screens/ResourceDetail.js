import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function ResourceDetailScreen({ route }) {
  const navigation = useNavigation();
  const resource = route?.params?.resource || {};

  const handleOpenLink = async () => {
    if (resource.url && (resource.url.startsWith('http://') || resource.url.startsWith('https://'))) {
      try {
        await Linking.openURL(resource.url);
      } catch (error) {
        console.warn('Failed to open URL', error);
      }
    }
  };

  const getLangBadge = (lang) => {
    if (!lang) return 'EN';
    return lang.toUpperCase().substring(0, 2);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Resource Details</Text>
          <View style={styles.spacer} />
        </View>

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarLetter}>{resource.title?.charAt(0) || 'R'}</Text>
            </View>
            <View style={styles.titleSection}>
              <Text style={styles.title}>{resource.title || 'Resource'}</Text>
              <Text style={styles.category}>{resource.category || 'General'}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getLangBadge(resource.language)}</Text>
            </View>
          </View>

          {resource.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.sectionContent}>{resource.description}</Text>
            </View>
          )}

          {resource.tags && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagRow}>
                {resource.tags.split(',').map((tag, idx) => (
                  <View style={styles.tag} key={idx}>
                    <Text style={styles.tagText}>{tag.trim()}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Language:</Text>
              <Text style={styles.infoValue}>{resource.language?.toUpperCase() || 'English'}</Text>
            </View>
            {resource.created_at && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Published:</Text>
                <Text style={styles.infoValue}>
                  {new Date(resource.created_at).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>

          {resource.url && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Access Resource</Text>
              <Text style={styles.urlPreview} numberOfLines={2}>
                {resource.url}
              </Text>
              <TouchableOpacity style={styles.openButton} onPress={handleOpenLink}>
                <Ionicons name="open-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.openButtonText}>Open Resource</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About This Resource</Text>
            <Text style={styles.aboutText}>
              This resource has been curated to support your mental health and wellness journey. 
              It provides culturally-grounded support and evidence-based practices to help you thrive.
            </Text>
          </View>
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
    padding: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  spacer: {
    width: 40,
  },
  card: {
    backgroundColor: '#fff',
    padding: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#d9e0ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4b3bff',
  },
  titleSection: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f1d2b',
    marginBottom: 4,
  },
  category: {
    fontSize: 13,
    color: '#6a6a7a',
  },
  badge: {
    backgroundColor: '#dfe7ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1b1b70',
  },
  section: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f1d2b',
    marginBottom: 10,
  },
  sectionContent: {
    fontSize: 14,
    color: '#3c3c42',
    lineHeight: 20,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#f1f1f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6d6d7a',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
  },
  urlPreview: {
    fontSize: 12,
    color: '#1c86ff',
    marginBottom: 12,
  },
  openButton: {
    flexDirection: 'row',
    backgroundColor: '#1c86ff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  openButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  aboutText: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
});
