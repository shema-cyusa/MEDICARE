import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, FlatList, Alert } from 'react-native';
import axios from 'axios';

const API_BASE = 'http://localhost:4000';

export default function LabDashboard({ route, navigation }) {
  const { labId, labName, labEmail, token } = route.params || {};
  const [assignments, setAssignments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const api = (path) =>
    axios.get(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

  useEffect(() => {
    navigation.setOptions({
      title: `${labName} Dashboard`,
      headerRight: () => (
        <TouchableOpacity
          style={{ paddingRight: 16 }}
          onPress={() => {
            navigation.navigate('Welcome');
          }}
        >
          <Text style={{ color: '#4A90E2', fontWeight: '600' }}>Logout</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, labName]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [assResp, notifResp] = await Promise.all([
          api(`/api/labs/${labId}/assignments`),
          api(`/api/labs/${labId}/notifications`),
        ]);
        setAssignments(assResp.data || []);
        setNotifications(notifResp.data?.notifications || []);
      } catch (e) {
        console.error('Failed to load data', e);
        Alert.alert('Error', 'Failed to load assignments and notifications');
      } finally {
        setLoading(false);
      }
    };

    if (labId && token) {
      loadData();
      // Poll every 10 seconds
      const interval = setInterval(loadData, 10000);
      return () => clearInterval(interval);
    }
  }, [labId, token]);

  const handleAcceptAssignment = async (assignmentId) => {
    try {
      await axios.post(
        `${API_BASE}/api/labs/assignments/${assignmentId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Assignment accepted');
      // Refresh
      const assResp = await api(`/api/labs/${labId}/assignments`);
      setAssignments(assResp.data || []);
    } catch (e) {
      Alert.alert('Error', 'Failed to accept assignment');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.labName}>{labName}</Text>
        <Text style={styles.labEmail}>{labEmail}</Text>
      </View>

      {/* Notifications */}
      {notifications.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          {notifications.map((n, idx) => (
            <View key={idx} style={styles.notificationItem}>
              <Text style={styles.notifType}>{n.type}</Text>
              <Text style={styles.notifTime}>{new Date(n.created_at).toLocaleString()}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Assignments */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Assignments</Text>
        {assignments.length === 0 ? (
          <Text style={styles.emptyText}>No assignments</Text>
        ) : (
          assignments.map((a) => (
            <View key={a.id} style={styles.assignmentCard}>
              <Text style={styles.assignmentTitle}>Assignment #{a.id}</Text>
              <Text style={styles.assignmentMeta}>Patient: {a.user_name || 'Unknown'}</Text>
              <Text style={styles.assignmentMeta}>Therapist: {a.therapist_name || 'N/A'}</Text>
              <Text style={styles.assignmentMeta}>Status: {a.status}</Text>
              <Text style={styles.assignmentMeta}>Assigned: {new Date(a.assigned_at).toLocaleString()}</Text>

              {a.message_content && (
                <Text style={styles.assignmentContent}>{a.message_content}</Text>
              )}

              {String(a.status).toLowerCase() === 'pending' && (
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleAcceptAssignment(a.id)}
                >
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#1A1A1A',
    padding: 20,
    alignItems: 'center',
  },
  labName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  labEmail: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 4,
  },
  section: {
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
  },
  notificationItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
  },
  notifType: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  notifTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  assignmentCard: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  assignmentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  assignmentMeta: {
    fontSize: 12,
    color: '#666',
    marginBottom: 3,
  },
  assignmentContent: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontFamily: 'monospace',
    padding: 6,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
  },
  acceptButton: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#4A90E2',
    borderRadius: 6,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
});
