import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, ActivityIndicator, TouchableOpacity, Linking, Platform, Alert, TextInput } from 'react-native';
import apiClient from '../api';

export default function AdminAppointments({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [status, setStatus] = useState('scheduled'); // or '' for all
  const [exporting, setExporting] = useState(false);
  const [searchText, setSearchText] = useState('');

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (status) params.status = status;
      if (searchText) params.search = searchText;
      const resp = await apiClient.get('/api/admin/appointments/export', { params, responseType: 'arraybuffer' });
      if (Platform.OS === 'web') {
        const blob = new Blob([resp.data], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `appointments-${new Date().toISOString().slice(0,10)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const adminPin = '2468';
        const queryStr = new URLSearchParams(params).toString();
        const url = `${apiClient.defaults.baseURL}/api/admin/appointments/export?admin_pin=${adminPin}&${queryStr}`;
        Alert.alert('Export', 'Opening export in browser...', [{ text: 'OK', onPress: () => Linking.openURL(url) }]);
      }
    } catch (e) {
      console.warn('Export failed', e);
      Alert.alert('Error', 'Failed to export appointments PDF');
    } finally {
      setExporting(false);
    }
  };

  const fetchAppointments = async (s = status) => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (s) params.status = s;
      const resp = await apiClient.get('/api/admin/appointments', { params });
      setAppointments(resp.data.appointments || resp.data);
    } catch (e) {
      console.warn('Failed to fetch admin appointments', e);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (mounted) fetchAppointments();
    return () => { mounted = false; };
  }, [status]);

  if (loading) return (<SafeAreaView style={styles.container}><ActivityIndicator style={{marginTop:40}} size="large" /></SafeAreaView>);

  // Filter appointments by search text
  const filteredAppointments = appointments.filter((appt) => {
    const searchLower = searchText.toLowerCase();
    const name = (appt.user_name || '').toLowerCase();
    const email = (appt.user_email || '').toLowerCase();
    const therapist = (appt.therapist_name || '').toLowerCase();
    return name.includes(searchLower) || email.includes(searchLower) || therapist.includes(searchLower);
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Text style={styles.backText}>{'\u2190'}</Text></TouchableOpacity>
          <Text style={styles.title}>Appointments</Text>
        </View>

        <View style={{flexDirection:'row', marginBottom:12, alignItems:'center'}}>
          <TouchableOpacity style={[styles.filterBtn, status === 'scheduled' && styles.filterActive]} onPress={() => setStatus('scheduled')}>
            <Text style={[styles.filterText, status === 'scheduled' && styles.filterTextActive]}>Scheduled</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, !status && styles.filterActive]} onPress={() => setStatus('')}>
            <Text style={[styles.filterText, !status && styles.filterTextActive]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport} disabled={exporting}>
            {exporting ? <ActivityIndicator /> : <Text style={styles.exportText}>Export PDF</Text>}
          </TouchableOpacity>
        </View>

        <TextInput style={styles.searchInput} placeholder="Search patient, email, or therapist..." value={searchText} onChangeText={setSearchText} />

        <FlatList
          data={filteredAppointments}
          keyExtractor={(item) => item.id?.toString()}
          renderItem={({item}) => (
            <View style={styles.row}>
              <View style={{flex:1}}>
                <Text style={styles.name}>{item.user_name} ➜ {item.therapist_name || '—'}</Text>
                <Text style={styles.sub}>{new Date(item.starts_at).toLocaleString()} • {item.status}</Text>
                {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => navigation.navigate('AdminAppointmentDetails', { id: item.id })}>
                <Text style={styles.view}>Details</Text>
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
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  filterBtn: { padding: 8, backgroundColor: '#fff', borderRadius: 8, marginRight: 8 },
  filterActive: { backgroundColor: '#F4A300' },
  filterText: { color: '#666', fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  exportBtn: { marginLeft: 'auto', padding: 8, backgroundColor: '#2E7D32', borderRadius: 8 },
  exportText: { color: '#fff', fontWeight: '700' },
  searchInput: { backgroundColor: '#fff', padding: 10, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#ddd', fontSize: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { padding: 8, marginRight: 8, backgroundColor: '#fff', borderRadius: 8 },
  backText: { fontSize: 18 },
  row: { backgroundColor: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '600' },
  sub: { color: '#666', fontSize: 12 },
  notes: { color: '#333', marginTop: 6 },
  view: { color: '#E74C3C', fontWeight: '600' },
});