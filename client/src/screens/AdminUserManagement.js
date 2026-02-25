import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import apiClient from '../api';

export default function AdminUserManagement({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [mode, setMode] = useState('users'); // users | therapists | labs
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (m = mode) => {
    setLoading(true);
    try {
      if (m === 'labs') {
        const resp = await apiClient.get('/api/labs');
        setData(resp.data || []);
      } else if (m === 'therapists') {
        const resp = await apiClient.get('/api/admin/therapists', { params: { limit: 200 } });
        setData(resp.data.therapists || resp.data || []);
      } else {
        const resp = await apiClient.get('/api/admin/users', { params: { user_type: 'user', limit: 200 } });
        setData(resp.data.users || resp.data || []);
      }
    } catch (e) {
      console.warn('Failed to fetch admin data', e);
      setData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (mounted) fetchData();
    return () => { mounted = false; };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData(mode);
  };

  if (loading) return (<SafeAreaView style={styles.container}><ActivityIndicator style={{marginTop:40}} size="large" /></SafeAreaView>);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Text style={styles.backText}>{'\u2190'}</Text></TouchableOpacity>
          <Text style={styles.title}>Manage Accounts</Text>
        </View>

        <View style={styles.segment}>
          <TouchableOpacity style={[styles.segmentButton, mode === 'users' && styles.segmentActive]} onPress={() => { setMode('users'); fetchData('users'); }}>
            <Text style={[styles.segmentText, mode === 'users' && styles.segmentTextActive]}>Patients</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segmentButton, mode === 'therapists' && styles.segmentActive]} onPress={() => { setMode('therapists'); fetchData('therapists'); }}>
            <Text style={[styles.segmentText, mode === 'therapists' && styles.segmentTextActive]}>Therapists</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.segmentButton, mode === 'labs' && styles.segmentActive]} onPress={() => { setMode('labs'); fetchData('labs'); }}>
            <Text style={[styles.segmentText, mode === 'labs' && styles.segmentTextActive]}>Labs</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={data}
          keyExtractor={(item) => item.id?.toString() || (item.name + Math.random()).toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({item}) => (
            <View style={styles.row}>
              <View style={{flex:1}}>
                <Text style={styles.name}>{item.name || item.title || '—'}</Text>
                {mode === 'labs' ? (
                  <Text style={styles.sub}>{item.contact_info}</Text>
                ) : mode === 'therapists' ? (
                  <Text style={styles.sub}>{item.email} • {item.phone || '—'} • {item.specialization}</Text>
                ) : (
                  <Text style={styles.sub}>{item.email} • {item.phone || '—'} • Joined {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}</Text>
                )}
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('AdminUserDetails', { item, mode })}>
                <Text style={styles.view}>View</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { flex: 1, padding: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { padding: 8, marginRight: 8, backgroundColor: '#fff', borderRadius: 8 },
  backText: { fontSize: 18 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  segment: { flexDirection: 'row', marginBottom: 12 },
  segmentButton: { flex: 1, padding: 10, backgroundColor: '#fff', borderRadius: 8, marginRight: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: '#F4A300' },
  segmentText: { color: '#666', fontWeight: '600' },
  segmentTextActive: { color: '#fff' },
  row: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { color: '#666', fontSize: 12 },
  view: { color: '#E74C3C', fontWeight: '600' },
});
