import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import apiClient from '../api';

export default function AdminUserDetails({ route, navigation }) {
  const { item, mode } = route.params || {};
  const [user, setUser] = useState(item || null);
  const [loading, setLoading] = useState(!item);

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      if (!item && route.params?.id) {
        try {
          const resp = await apiClient.get(`/api/users/${route.params.id}`);
          if (mounted) setUser(resp.data);
        } catch (e) {
          console.warn('Failed to fetch user', e);
        } finally {
          if (mounted) setLoading(false);
        }
      }
    };
    fetch();
    return () => { mounted = false; };
  }, [item, route.params]);

  if (loading) return (<SafeAreaView style={styles.container}><ActivityIndicator style={{marginTop:40}} size="large" /></SafeAreaView>);
  if (!user) return (<SafeAreaView style={styles.container}><View style={styles.content}><Text>User not found</Text></View></SafeAreaView>);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Text style={styles.backText}>{'\u2190'}</Text></TouchableOpacity>
          <Text style={styles.title}>Account Details</Text>
        </View>

        <View style={styles.row}><Text style={styles.label}>Name</Text><Text style={styles.value}>{user.name || '—'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Email</Text><Text style={styles.value}>{user.email || '—'}</Text></View>
        <View style={styles.row}><Text style={styles.label}>User Type</Text><Text style={styles.value}>{user.user_type || (mode === 'therapists' ? 'therapist' : mode === 'labs' ? 'lab' : 'user')}</Text></View>
        <View style={styles.row}><Text style={styles.label}>Phone</Text><Text style={styles.value}>{user.phone || '—'}</Text></View>
        {user.created_at ? <View style={styles.row}><Text style={styles.label}>Joined</Text><Text style={styles.value}>{new Date(user.created_at).toLocaleString()}</Text></View> : null}
        {mode === 'therapists' ? (
          <>
            <View style={styles.row}><Text style={styles.label}>Specialization</Text><Text style={styles.value}>{user.specialization || '—'}</Text></View>
            <View style={styles.row}><Text style={styles.label}>Verified</Text><Text style={styles.value}>{user.is_verified ? 'Yes' : 'No'}</Text></View>
          </>
        ) : null}

        {mode === 'labs' ? (
          <View style={styles.row}><Text style={styles.label}>Contact</Text><Text style={styles.value}>{user.contact_info || '—'}</Text></View>
        ) : null}

        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.closeText}>Close</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { padding: 8, marginRight: 8, backgroundColor: '#fff', borderRadius: 8 },
  backText: { fontSize: 18 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  label: { color: '#666', fontWeight: '600' },
  value: { fontWeight: '600' },
  closeBtn: { marginTop: 24, backgroundColor: '#2E7D32', padding: 12, borderRadius: 8, alignItems: 'center' },
  closeText: { color: '#fff', fontWeight: '700' },
});