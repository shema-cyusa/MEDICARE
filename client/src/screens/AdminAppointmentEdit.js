import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import apiClient from '../api';

export default function AdminAppointmentEdit({ route, navigation }) {
  const { id } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [appt, setAppt] = useState(null);
  const [meetLink, setMeetLink] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const resp = await apiClient.get(`/api/appointments/${id}`);
        if (mounted) {
          setAppt(resp.data);
          setMeetLink(resp.data.meet_link || '');
          setStatus(resp.data.status || '');
        }
      } catch (e) {
        console.warn('Failed to fetch appointment', e);
        Alert.alert('Error', 'Failed to fetch appointment');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (id) fetch();
    return () => { mounted = false; };
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { meet_link: meetLink, status };
      await apiClient.patch(`/api/admin/appointments/${id}`, payload);
      // After save, navigate back to details and refresh
      navigation.replace('AdminAppointmentDetails', { id });
    } catch (e) {
      console.warn('Failed to save appointment', e);
      Alert.alert('Error', 'Failed to save appointment');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (<SafeAreaView style={styles.container}><ActivityIndicator style={{marginTop:40}} size="large" /></SafeAreaView>);
  if (!appt) return (<SafeAreaView style={styles.container}><View style={styles.content}><Text>Appointment not found</Text></View></SafeAreaView>);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Text style={styles.backText}>{'\u2190'}</Text></TouchableOpacity>
          <Text style={styles.title}>Edit Appointment</Text>
        </View>

        <View style={{marginTop:8}}>
          <Text style={styles.label}>Meeting Link</Text>
          <TextInput style={styles.input} value={meetLink} onChangeText={setMeetLink} placeholder="https://meet.example/abc" autoCapitalize="none" />
        </View>

        <View style={{marginTop:12}}>
          <Text style={styles.label}>Status</Text>
          <TextInput style={styles.input} value={status} onChangeText={setStatus} placeholder="scheduled / confirmed / canceled" />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
        </TouchableOpacity>
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
  title: { fontSize: 20, fontWeight: '700' },
  label: { color: '#666', fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
  saveBtn: { marginTop: 20, backgroundColor: '#2E7D32', padding: 12, borderRadius: 8, alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700' },
});