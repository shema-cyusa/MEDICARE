import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { appointmentApi } from '../api';

export default function AppointmentDetails({ route, navigation }) {
  const { appointmentId } = route.params || {};
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Format appointment time nicely
  const formatAppointmentTime = (startsAt) => {
    if (!startsAt) return 'N/A';
    try {
      // Parse the datetime string (e.g., "2026-02-27T09:00:00")
      const dt = new Date(startsAt);
      if (isNaN(dt.getTime())) return startsAt;
      
      const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      };
      return dt.toLocaleString(undefined, options);
    } catch (e) {
      return startsAt;
    }
  };

  const load = async () => {
    if (!appointmentId) return;
    setLoading(true);
    try {
      const resp = await appointmentApi.getById(appointmentId);
      setAppointment(resp.data);
    } catch (e) {
      console.warn('Failed to load appointment', e);
      Alert.alert('Error', 'Failed to load appointment.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [appointmentId]);

  const handleUpdate = async (status) => {
    if (!appointmentId) return;
    setUpdating(true);
    try {
      const resp = await appointmentApi.update(appointmentId, { status });
      setAppointment(resp.data);
      Alert.alert('Success', `Appointment ${status}`);
      navigation.goBack();
    } catch (e) {
      console.warn('Failed to update appointment', e);
      Alert.alert('Error', 'Failed to update appointment.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <SafeAreaView style={styles.container}><ActivityIndicator size="large" /></SafeAreaView>
  );

  if (!appointment) return (
    <SafeAreaView style={styles.container}><View style={styles.center}><Text>No appointment found.</Text></View></SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.card}>
          <Text style={styles.title}>Appointment Request</Text>
          <View style={styles.row}><Text style={styles.label}>Patient:</Text><Text style={styles.value}>{appointment.user_name || appointment.user_id}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Patient Email:</Text><Text style={styles.value}>{appointment.user_email || 'N/A'}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Scheduled:</Text><Text style={styles.value}>{formatAppointmentTime(appointment.starts_at)}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Status:</Text><Text style={styles.value}>{appointment.status}</Text></View>
          {appointment.notes ? (
            <View style={styles.row}><Text style={styles.label}>Notes:</Text><Text style={styles.value}>{appointment.notes}</Text></View>
          ) : null}

          {appointment.meet_link && (
            <View style={styles.linkSection}>
              <Text style={styles.label}>Meeting Link:</Text>
              <TouchableOpacity 
                style={styles.linkButton}
                onPress={async () => {
                  const url = appointment.meet_link;
                  try {
                    const supported = await Linking.canOpenURL(url);
                    if (supported) {
                      await Linking.openURL(url);
                    } else {
                      Alert.alert('Copy Link', `Link: ${url}`);
                    }
                  } catch (e) {
                    Alert.alert('Error', 'Could not open link.');
                  }
                }}
              >
                <Ionicons name="open-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.linkButtonText}>Open Meeting Link</Text>
              </TouchableOpacity>
              <Text style={styles.linkValue}>{appointment.meet_link}</Text>
            </View>
          )}

          <View style={styles.actions}>
            {appointment.status !== 'accepted' && (
              <TouchableOpacity style={styles.accept} onPress={() => handleUpdate('accepted')} disabled={updating}><Text style={styles.acceptText}>Accept</Text></TouchableOpacity>
            )}
            {appointment.status !== 'rejected' && (
              <TouchableOpacity style={styles.reject} onPress={() => handleUpdate('rejected')} disabled={updating}><Text style={styles.rejectText}>Reject</Text></TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 18 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 8 },
  label: { color: '#666', fontWeight: '600' },
  value: { fontWeight: '700' },
  linkSection: { marginVertical: 12, paddingVertical: 12, paddingHorizontal: 10, backgroundColor: '#f0f8ff', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#0b61c6' },
  linkButton: { flexDirection: 'row', backgroundColor: '#0b61c6', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 6, alignItems: 'center', marginVertical: 8 },
  linkButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  linkValue: { fontSize: 12, color: '#0b61c6', marginTop: 6, fontWeight: '500' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 8 },
  accept: { backgroundColor: '#0b61c6', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  acceptText: { color: '#fff', fontWeight: '700' },
  reject: { backgroundColor: '#eee', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginLeft: 8 },
  rejectText: { color: '#333', fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});