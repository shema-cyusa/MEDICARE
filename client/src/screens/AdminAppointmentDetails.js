import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, TouchableOpacity, Linking, ScrollView } from 'react-native';
import apiClient from '../api';

export default function AdminAppointmentDetails({ route, navigation }) {
  const { id } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [appt, setAppt] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  function formatDate(val) {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString();
  }

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      try {
        const resp = await apiClient.get(`/api/appointments/${id}`);
        if (mounted) setAppt(resp.data);
      } catch (e) {
        console.warn('Failed to fetch appointment', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    if (id) fetch();
    return () => { mounted = false; };
  }, [id]);

  if (loading) return (<SafeAreaView style={styles.container}><ActivityIndicator style={{marginTop:40}} size="large" /></SafeAreaView>);

  if (!appt) return (<SafeAreaView style={styles.container}><View style={styles.content}><Text>Appointment not found</Text></View></SafeAreaView>);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Text style={styles.backText}>{'\u2190'}</Text></TouchableOpacity>
          <Text style={styles.title}>Appointment Details</Text>
          <TouchableOpacity onPress={() => navigation.navigate('AdminAppointmentEdit', { id: appt.id })} style={styles.editBtn}><Text style={styles.editText}>Edit</Text></TouchableOpacity>
        </View>
        <View style={styles.row}><Text style={styles.label}>Patient</Text><Text style={styles.value}>{appt.user_name} ({appt.user_email})</Text></View>
        <View style={styles.row}><Text style={styles.label}>Therapist</Text><Text style={styles.value}>{appt.therapist_name || '—'} ({appt.therapist_email || '—'})</Text></View>
        <View style={styles.row}><Text style={styles.label}>Starts At</Text><Text style={styles.value}>{formatDate(appt.starts_at)}</Text></View>
        {appt.ends_at ? <View style={styles.row}><Text style={styles.label}>Ends At</Text><Text style={styles.value}>{formatDate(appt.ends_at)}</Text></View> : null}
        <View style={styles.row}><Text style={styles.label}>Status</Text><Text style={styles.value}>{appt.status}</Text></View>
        {appt.notes ? <View style={{marginTop:12}}><Text style={styles.sectionTitle}>Notes</Text><Text style={styles.notes}>{appt.notes}</Text></View> : null}
        {appt.meet_link ? (
          <TouchableOpacity style={styles.linkButton} onPress={() => Linking.openURL(appt.meet_link)}>
            <Text style={styles.linkText}>Open meeting link</Text>
          </TouchableOpacity>
        ) : null}

        <View style={{marginTop:20}}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.row}><Text style={styles.label}>ID</Text><Text style={styles.value}>{appt.id}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Created</Text><Text style={styles.value}>{formatDate(appt.created_at)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Updated</Text><Text style={styles.value}>{formatDate(appt.updated_at)}</Text></View>
          <View style={styles.row}>
            <Text style={styles.label}>Meeting Link</Text>
            {appt.meet_link ? (
              <Text style={[styles.value, styles.linkText]} onPress={() => Linking.openURL(appt.meet_link)}>{appt.meet_link}</Text>
            ) : (
              <Text style={styles.value}>—</Text>
            )}
          </View>
          {appt.notes ? <View style={{marginTop:12}}><Text style={styles.sectionTitle}>Notes</Text><Text style={styles.notes}>{appt.notes}</Text></View> : null}

          <TouchableOpacity style={styles.rawToggle} onPress={() => setShowRaw(s => !s)}>
            <Text style={styles.rawToggleText}>{showRaw ? 'Hide raw' : 'Show raw'}</Text>
          </TouchableOpacity>

          {showRaw ? (
            <View style={{marginTop:12}}>
              <Text style={styles.sectionTitle}>Raw JSON</Text>
              <Text style={styles.raw}>{JSON.stringify(appt, null, 2)}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  label: { color: '#666', fontWeight: '600' },
  value: { fontWeight: '600' },
  sectionTitle: { fontWeight: '700', marginBottom: 6 },
  notes: { color: '#333' },
  linkButton: { marginTop: 12, padding: 12, backgroundColor: '#F4A300', borderRadius: 8, alignItems: 'center' },
  linkText: { color: '#fff', fontWeight: '600' },
  raw: { fontFamily: 'monospace', color: '#333', marginTop: 8 },
  rawToggle: { marginTop: 12, padding: 8, alignItems: 'center', backgroundColor: '#fff', borderRadius: 8 },
  rawToggleText: { color: '#666', fontWeight: '600' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  backBtn: { padding: 8, marginRight: 8, backgroundColor: '#fff', borderRadius: 8 },
  backText: { fontSize: 18 },
  editBtn: { marginLeft: 'auto', padding: 8, backgroundColor: '#fff', borderRadius: 8 },
  editText: { color: '#2E7D32', fontWeight: '700' },
  linkText: { color: '#1A73E8', textDecorationLine: 'underline' }
});