import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import axios from 'axios';

const API_BASE = 'http://localhost:4000';

export default function LabHome({ route, navigation }) {
  const { labId, labName, labEmail, token } = route.params || {};
  const [stats, setStats] = useState({ assignments: 0, notifications: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({
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
  }, [navigation]);

  useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      try {
        const [assResp, notifResp] = await Promise.all([
          axios.get(`${API_BASE}/api/labs/${labId}/assignments`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_BASE}/api/labs/${labId}/notifications`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const assignments = assResp.data || [];
        const notifications = notifResp.data?.notifications || [];
        const pending = assignments.filter((a) => String(a.status).toLowerCase() === 'pending').length;

        setStats({
          assignments: assignments.length,
          notifications: notifications.length,
          pending,
        });
      } catch (e) {
        console.error('Failed to load stats', e);
      } finally {
        setLoading(false);
      }
    };

    if (labId && token) {
      loadStats();
    }
  }, [labId, token]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.labName}>{labName}</Text>
        <Text style={styles.labEmail}>{labEmail}</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.assignments}</Text>
          <Text style={styles.statLabel}>Total Assignments</Text>
        </View>
        <View style={[styles.statCard, styles.pendingCard]}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.notifications}</Text>
          <Text style={styles.statLabel}>Notifications</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Access</Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('LabAssignments')}
        >
          <Text style={styles.actionButtonIcon}>📋</Text>
          <View style={styles.actionButtonContent}>
            <Text style={styles.actionButtonTitle}>View All Assignments</Text>
            <Text style={styles.actionButtonDesc}>Review and accept assignments</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('LabNotifications')}
        >
          <Text style={styles.actionButtonIcon}>🔔</Text>
          <View style={styles.actionButtonContent}>
            <Text style={styles.actionButtonTitle}>Notifications</Text>
            <Text style={styles.actionButtonDesc}>See recent updates</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => navigation.navigate('LabProfile')}
        >
          <Text style={styles.actionButtonIcon}>👤</Text>
          <View style={styles.actionButtonContent}>
            <Text style={styles.actionButtonTitle}>Lab Profile</Text>
            <Text style={styles.actionButtonDesc}>View lab information</Text>
          </View>
        </TouchableOpacity>
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
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pendingCard: {
    backgroundColor: '#fff3e0',
    borderColor: '#ffb74d',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4A90E2',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    color: '#333',
  },
  actionButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  actionButtonIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  actionButtonContent: {
    flex: 1,
  },
  actionButtonTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  actionButtonDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});
