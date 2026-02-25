import React, { useContext } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import AuthContext from '../context/AuthContext';

export default function AdminProfile({ navigation }) {
  const { user, logout } = useContext(AuthContext);

  const handleLogout = async () => {
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.row}><Text style={styles.label}>Name</Text><Text style={styles.value}>{user?.name || '—'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Email</Text><Text style={styles.value}>{user?.email || '—'}</Text></View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  label: { color: '#666', fontWeight: '600' },
  value: { fontWeight: '600' },
  logoutButton: { marginTop: 24, backgroundColor: '#E74C3C', padding: 12, borderRadius: 8, alignItems: 'center' },
  logoutText: { color: '#fff', fontWeight: '700' },
});