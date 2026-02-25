import React, { useContext, useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Modal,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AuthContext from '../context/AuthContext';
import { therapistApi, appointmentApi } from '../api';

const PROVIDERS = [
  { id: '1', name: 'Diana', role: 'CBT', type: 'Therapist' },
  { id: '2', name: 'Nema', role: 'Family', type: 'Therapist' },
  { id: '3', name: 'Ishimwe', role: 'Therapist', type: 'Therapist' },
];

export default function TelehealthScreen() {
  const navigation = useNavigation();

  const { user } = useContext(AuthContext);

  const [bookingVisible, setBookingVisible] = useState(false);
  const [therapists, setTherapists] = useState(PROVIDERS);
  const [selectedTherapistId, setSelectedTherapistId] = useState(null);
  const [callType, setCallType] = useState('meet');
  const [startsAt, setStartsAt] = useState('');
  const [meetingLink, setMeetingLink] = useState('');

  const handleBookSession = () => {
    navigation.navigate('BookSession');
  };

  const handleChatWithTherapist = () => {
    navigation.navigate('Messages');
  };

  const handleVideoCall = async () => {
    // Fetch therapists from API (fallback to local PROVIDERS) and show booking modal
    try {
      const resp = await therapistApi.getAll();
      if (Array.isArray(resp.data) && resp.data.length > 0) setTherapists(resp.data);
    } catch (e) {
      // keep local PROVIDERS if API fails
    }
    setBookingVisible(true);
  };

  const handleSubmitBooking = async () => {
    if (!user) return Alert.alert('Login required', 'Please login to book a video call.');
    const therapist_id = selectedTherapistId || (therapists[0] && therapists[0].id);
    if (!therapist_id) return Alert.alert('Choose therapist', 'Please select a therapist.');
    if (!startsAt) return Alert.alert('Choose date/time', 'Please enter a date/time for the meeting (ISO string recommended).');
    if (!meetingLink) return Alert.alert('Add meeting link', 'Please paste the Google Meet or Zoom link.');
    try {
      const payload = {
        user_id: user.id,
        therapist_id,
        starts_at: startsAt,
        call_type: callType,
        meeting_link: meetingLink,
      };
      await appointmentApi.create(payload);
      setBookingVisible(false);
      setSelectedTherapistId(null);
      setStartsAt('');
      setMeetingLink('');
      Alert.alert('Requested', 'Video appointment requested. Your therapist will receive a notification with all details.');
    } catch (e) {
      console.warn('Failed to create appointment', e);
      Alert.alert('Error', 'Failed to send appointment request.');
    }
  };

  const handleGoogleMeet = async () => {
    const url = 'https://meet.google.com/new';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Open Google Meet', `Please open this link in your browser: ${url}`);
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to open Google Meet.');
    }
  };

  const handleZoom = async () => {
    const url = 'https://zoom.us/start/videomeeting';
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Open Zoom', `Please open this link in your browser: ${url}`);
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to open Zoom.');
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleHomePress = () => {
    navigation.navigate('UserDashboard');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <View style={styles.headerTitle}>
              <Text style={styles.title}>Telehealth and Counseling</Text>
              <Text style={styles.subtitle}>
                Welcome to the counseling page where you get advised and taken care of with specialists.
              </Text>
              <Text style={styles.subtitle}>Which doctor would you like to handle you today?</Text>
            </View>
            <TouchableOpacity style={styles.homePill} onPress={handleHomePress}>
              <Text style={styles.homeText}>Home</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttonRowTop}>
            <TouchableOpacity style={styles.topButton} onPress={handleBookSession}>
              <Text style={styles.topButtonText}>Book a Session</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.topButton} onPress={handleChatWithTherapist}>
              <Text style={styles.topButtonText}>Chat with a Therapist</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.topButton} onPress={handleVideoCall}>
              <Text style={styles.topButtonText}>Video Call</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionHeading}>Talk to a Professional</Text>
          <View style={styles.providersGrid}>
            {PROVIDERS.map((provider) => (
              <View style={styles.providerCard} key={provider.id}>
                <View style={styles.providerAvatar} />
                <Text style={styles.providerName}>{provider.name}</Text>
                <Text style={styles.providerRole}>{provider.role}</Text>
                <TouchableOpacity
                  style={styles.bookButton}
                  onPress={() => navigation.navigate('BookSession', { therapist: provider })}
                >
                  <Text style={styles.bookText}>Book</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>

          <View style={styles.rememberCard}>
            <Text style={styles.rememberTitle}>Remember</Text>
            <Text style={styles.rememberBody}>Your mental health is just as important as your physical health.</Text>
            <TouchableOpacity style={styles.rateButton}>
              <Text style={styles.rateText}>Rate</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
      <Modal visible={bookingVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Book Video Call</Text>
            <Text style={styles.inputLabel}>Call type</Text>
            <View style={styles.callTypeRow}>
              <TouchableOpacity style={[styles.callTypeButton, callType === 'meet' && styles.callTypeActive]} onPress={() => setCallType('meet')}>
                <Text style={styles.callTypeText}>Google Meet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.callTypeButton, callType === 'zoom' && styles.callTypeActive]} onPress={() => setCallType('zoom')}>
                <Text style={styles.callTypeText}>Zoom</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Therapist</Text>
            <ScrollView style={{ maxHeight: 120 }}>
              {therapists.map((t) => (
                <TouchableOpacity key={t.id} style={[styles.therapistRow, selectedTherapistId === t.id && styles.therapistSelected]} onPress={() => setSelectedTherapistId(t.id)}>
                  <Text style={styles.therapistName}>{t.name || t.full_name || t.title || `Therapist ${t.id}`}</Text>
                  <Text style={styles.therapistRole}>{t.role || t.specialization || ''}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.inputLabel}>Date / Time (ISO)</Text>
            <TextInput style={styles.input} placeholder="2026-01-09T13:30:00Z" value={startsAt} onChangeText={setStartsAt} />

            <Text style={styles.inputLabel}>Meeting Link</Text>
            <TextInput style={styles.input} placeholder="https://meet.google.com/abc-defg-hij or zoom link" value={meetingLink} onChangeText={setMeetingLink} />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setBookingVisible(false)}>
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.modalPrimary]} onPress={handleSubmitBooking}>
                <Text style={[styles.modalButtonText, { color: '#fff' }]}>Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scroll: {
    padding: 18,
    paddingBottom: 40,
    backgroundColor: '#ffffff',
  },
  card: {
    borderRadius: 28,
    backgroundColor: '#fff',
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d8d1c6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  backText: { fontSize: 18, color: '#2c2c2c' },
  headerTitle: {
    flex: 1,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#1b1b1f' },
  subtitle: { fontSize: 12, color: '#6d6d74' },
  homePill: {
    backgroundColor: '#f0f0f0',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  homeText: { fontSize: 11, fontWeight: '600', color: '#333333' },
  buttonRowTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  topButton: {
    backgroundColor: '#f5e6d3',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  topButtonText: { fontSize: 12, fontWeight: '700', color: '#333333' },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a20',
    marginBottom: 12,
  },
  providersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 16,
  },
  providerCard: {
    width: '48%',
    borderRadius: 20,
    backgroundColor: '#f9f7ff',
    padding: 12,
    alignItems: 'center',
  },
  providerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#dcdcdc',
    marginBottom: 10,
  },
  providerName: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  providerRole: { fontSize: 12, color: '#6d6d74', marginBottom: 10 },
  bookButton: {
    backgroundColor: '#000',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 18,
  },
  bookText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  rememberCard: {
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    padding: 14,
    marginTop: 8,
  },
  rememberTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  rememberBody: { fontSize: 12, color: '#4a4a4a', marginBottom: 10 },
  rateButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 18,
  },
  rateText: { fontSize: 12, fontWeight: '700', color: '#333333' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  inputLabel: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  callTypeRow: { flexDirection: 'row', marginTop: 8 },
  callTypeButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', marginRight: 8 },
  callTypeActive: { backgroundColor: '#f5e6d3', borderColor: '#e6cfae' },
  callTypeText: { fontSize: 12, fontWeight: '700' },
  therapistRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
  therapistSelected: { backgroundColor: '#f0f8ff' },
  therapistName: { fontSize: 14, fontWeight: '700' },
  therapistRole: { fontSize: 12, color: '#666' },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 8, marginTop: 6 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  modalButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginLeft: 8, borderWidth: 1, borderColor: '#ccc' },
  modalPrimary: { backgroundColor: '#08c6ff', borderColor: '#08c6ff' },
  modalButtonText: { fontSize: 14, fontWeight: '700' },
});