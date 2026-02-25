import React, { useEffect, useState, useContext } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import apiClient from '../api';
import AuthContext from '../context/AuthContext';

export default function AdminDashboard({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const { logout } = useContext(AuthContext);

  useEffect(() => {
    let mounted = true;
    const fetchStats = async () => {
      try {
        const resp = await apiClient.get('/api/admin/analytics');
        if (mounted) setStats(resp.data);
      } catch (e) {
        console.warn('Failed to fetch admin analytics', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchStats();
    return () => { mounted = false; };
  }, []);

  const handleLogoutPress = async () => {
    try {
      await logout();
      const rootNav = navigation?.getParent?.getParent?.getParent();
      if (rootNav && rootNav.reset) {
        rootNav.reset({ index: 0, routes: [{ name: 'Welcome' }] });
      }
    } catch (error) {
      console.warn('Logout failed', error);
      Alert.alert('Error', 'Unable to log out right now.');
    }
  };

  if (loading) return (
    <SafeAreaView style={styles.container}><ActivityIndicator style={{marginTop:40}} size="large" /></SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Admin Dashboard</Text>
        {stats ? (
          <View style={styles.cards}>
            <View style={styles.card}><Text style={styles.cardLabel}>Users</Text><Text style={styles.cardValue}>{stats.users?.total}</Text></View>
            <View style={styles.card}><Text style={styles.cardLabel}>Assessments</Text><Text style={styles.cardValue}>{stats.assessments?.total}</Text></View>
            <View style={styles.card}><Text style={styles.cardLabel}>Upcoming Appts</Text><Text style={styles.cardValue}>{stats.appointments?.upcoming}</Text></View>
          </View>
        ) : null}

        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('AdminUsers')}>
          <Text style={styles.buttonText}>Manage Users</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('AdminAppointments')}>
          <Text style={styles.buttonText}>Manage Appointments</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogoutPress}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 20 },
  cards: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 8, width: '30%', alignItems: 'center', shadowColor:'#000', shadowOpacity:0.06, shadowRadius:6 },
  cardLabel: { color: '#666', fontSize: 12 },
  cardValue: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  button: { backgroundColor: '#F4A300', padding: 14, borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  logoutButton: { backgroundColor: '#E74C3C', padding: 12, borderRadius: 8, marginTop: 8, alignItems: 'center' },
  logoutText: { color: '#fff', fontWeight: '700' },
});
