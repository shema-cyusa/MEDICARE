import { SafeAreaView, ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import React, { useEffect, useState, useContext } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import AuthContext from '../context/AuthContext';
import { assessmentApi } from '../api';

export default function AggregatedAssessments({ navigation }) {
  const { user } = useContext(AuthContext);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load assessments on mount
  useEffect(() => {
    loadAssessments();
  }, []);

  // Reload assessments whenever this screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadAssessments();
    }, [])
  );

  const loadAssessments = async () => {
    try {
      setLoading(true);
      const response = await assessmentApi.getTherapistTemplates();
      // Handle both direct array response and nested data property
      const data = Array.isArray(response) ? response : (response.data && Array.isArray(response.data) ? response.data : []);
      setAssessments(data);
    } catch (error) {
      console.error('Failed to load diagnoses:', error);
      setAssessments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePress = () => {
    navigation.navigate('AssessmentCreateScreen');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Diagnoses</Text>
          <TouchableOpacity style={styles.createButton} onPress={handleCreatePress}>
            <Text style={styles.createText}>Create Diagnosis</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0B61C6" style={styles.loader} />
        ) : assessments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No diagnoses yet. Create one to get started!</Text>
          </View>
        ) : (
          <View style={styles.listRow}>
            {assessments.map((assessment) => (
              <View key={assessment.id} style={styles.card}>
                <Text style={styles.cardTitle}>{assessment.title}</Text>
                <Text style={styles.cardLabel}>
                  Questions: {assessment.questions?.length || 0}
                </Text>
                <Text style={styles.cardLabel}>
                  Published: {assessment.is_published ? 'Yes' : 'No'}
                </Text>
                <Text style={styles.cardLabel}>
                  Created: {new Date(assessment.created_at).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#161823',
  },
  createButton: {
    backgroundColor: '#0B61C6',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 16,
  },
  createText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  listRow: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  card: {
    borderRadius: 14,
    backgroundColor: '#f6f7fb',
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1b1d2b',
    marginBottom: 6,
  },
  cardLabel: {
    fontSize: 12,
    color: '#5b5b71',
    marginBottom: 4,
  },
  loader: {
    marginVertical: 32,
  },
  emptyContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  emptyText: {
    fontSize: 14,
    color: '#5b5b71',
    textAlign: 'center',
  },
});
