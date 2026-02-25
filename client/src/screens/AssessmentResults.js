import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthContext from '../context/AuthContext';
import { assessmentApi, therapistApi, appointmentApi, messageApi, labsApi } from '../api';

export default function AssessmentResults({ route, navigation }) {
  const { assessmentId } = route.params || {};
  const { user } = useContext(AuthContext);
  const [assessment, setAssessment] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showExamForm, setShowExamForm] = useState(false);
  const [examText, setExamText] = useState('');
  const [sendingExam, setSendingExam] = useState(false);
  const DEMO_LABS = [
    // initial placeholder until loaded from server
  ];
  const [labs, setLabs] = useState([]);
  const [selectedLab, setSelectedLab] = useState(null);
  const [scheduledDate, setScheduledDate] = useState(''); // yyyy-mm-dd
  const [scheduledTime, setScheduledTime] = useState(''); // HH:MM
  const [bookingTherapist, setBookingTherapist] = useState(null);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (assessmentId) {
        // Load the specific assessment referred by notifications/navigation
        const resp = await assessmentApi.getById(assessmentId);
        if (resp.data) {
          setAssessment(resp.data);
          const adviceResp = await assessmentApi.getAdvice(resp.data.id);
          setAdvice(adviceResp.data);
        }
      } else if (user?.id) {
        // Fallback: load latest assessment for current user
        const latestResp = await assessmentApi.getLatest(user.id);
        if (latestResp.data) {
          setAssessment(latestResp.data);
          const adviceResp = await assessmentApi.getAdvice(latestResp.data.id);
          setAdvice(adviceResp.data);
        }
      }

      const therapistsResp = await therapistApi.getAll();
      setTherapists(Array.isArray(therapistsResp.data) ? therapistsResp.data : []);
      // load labs from server
      try {
        const labsResp = await labsApi.getAll();
        const labList = Array.isArray(labsResp.data) ? labsResp.data : [];
        setLabs(labList);
        if (!selectedLab && labList.length) setSelectedLab(labList[0].id);
      } catch (e) {
        console.warn('Failed to load labs', e.message || e);
      }
    } catch (error) {
      console.warn('Failed to load results', error.message || error);
      // Don't show alert here; let the "Assessment not found" UI handle it
    } finally {
      setLoading(false);
    }
  }, [assessmentId, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBookAppointment = async (therapist) => {
    if (!user?.id || !therapist?.id) {
      Alert.alert('Error', 'Unable to book appointment.');
      return;
    }

    // Create a default start time: tomorrow at 2:00 PM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);
    const startsAt = tomorrow.toISOString();

    Alert.alert(
      'Book Appointment',
      `Book a session with ${therapist.name}?`,
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Book',
          onPress: async () => {
            try {
              await appointmentApi.create({
                user_id: user.id,
                therapist_id: therapist.id,
                starts_at: startsAt,
              });
              Alert.alert('Success', 'Appointment request sent!');
              setBookingModalVisible(false);
            } catch (error) {
              console.warn('Failed to book appointment', error);
              Alert.alert('Error', 'Failed to book appointment.');
            }
          },
        },
      ]
    );
  };

  const isTherapist = !!user?.therapist_id;

  const handleSendExamination = async () => {
    if (!assessment || !assessment.user_id) {
      Alert.alert('Error', 'Unable to find patient for this result.');
      return;
    }
    if (!examText.trim()) {
      Alert.alert('Validation', 'Please enter the examination details.');
      return;
    }
    setSendingExam(true);
    try {
      const lab = DEMO_LABS.find((l) => l.id === selectedLab) || DEMO_LABS[0];
      // prefer real labs if available
      const foundLab = labs.find((l) => String(l.id) === String(selectedLab));
      const labObj = foundLab || (DEMO_LABS.find((l) => l.id === selectedLab) || DEMO_LABS[0]);
      let scheduled_at = null;
      if (scheduledDate && scheduledTime) {
        // Naive combine: assume local date/time and convert to ISO
        const combined = new Date(`${scheduledDate}T${scheduledTime}`);
        if (!Number.isNaN(combined.getTime())) scheduled_at = combined.toISOString();
      }
      const contentObj = {
        kind: 'examination',
        examination: examText.trim(),
        assessment_id: assessment.id,
        lab_id: labObj.id,
        lab_name: labObj.name,
        scheduled_at,
      };
      const sendPayload = {
        user_id: assessment.user_id,
        therapist_id: user?.therapist_id || user?.id,
        sender_type: 'therapist',
        content: JSON.stringify(contentObj),
      };
      await messageApi.sendMessage(sendPayload);
      Alert.alert('Success', 'Examination suggestion sent to patient.');
      setExamText('');
      setShowExamForm(false);
    } catch (error) {
      console.warn('Failed to send examination', error);
      Alert.alert('Error', 'Failed to send examination suggestion.');
    } finally {
      setSendingExam(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0b61c6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!assessment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Assessment not found.</Text>
          <TouchableOpacity
            onPress={() => navigation?.goBack()}
            style={styles.backButtonLarge}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const scorePercentage = assessment.total_percent || 0;
  const scoreStatus =
    scorePercentage >= 75
      ? 'Excellent'
      : scorePercentage >= 50
      ? 'Good'
      : scorePercentage >= 25
      ? 'Fair'
      : 'Low';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <TouchableOpacity
            onPress={() => navigation?.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#0b61c6" />
          </TouchableOpacity>

          <View style={styles.scoreSection}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>{scorePercentage}%</Text>
              <Text style={styles.scoreLabel}>{scoreStatus}</Text>
            </View>
            <Text style={styles.scoreDescription}>
              Your mental health status: You are managing well emotionally.
            </Text>
          </View>

          {advice && (
            <View style={styles.adviceSection}>
              <View style={styles.adviceHeader}>
                <Ionicons name="sparkles" size={20} color="#6b4fd9" />
                <Text style={styles.adviceTitle}>{advice.title || 'Personalized Recommendations'}</Text>
              </View>
              <Text style={styles.adviceIntro}>
                {advice.intro || 'Based on your assessment results, here are personalized recommendations.'}
              </Text>
              {Array.isArray(advice.actions) && advice.actions.length > 0 && (
                <View style={styles.actionsList}>
                  {advice.actions.map((action, idx) => (
                    <View key={`action-${idx}`} style={styles.actionItem}>
                      <Text style={styles.actionNumber}>{idx + 1}</Text>
                      <Text style={styles.actionText}>{action}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {isTherapist && (
            <View style={styles.examinationSection}>
              <View style={styles.bookingHeader}>
                <Ionicons name="medical" size={20} color="#0b61c6" />
                <Text style={styles.bookingTitle}>Suggest Examination</Text>
              </View>
              {!showExamForm ? (
                <TouchableOpacity style={styles.suggestButton} onPress={() => setShowExamForm(true)}>
                  <Text style={styles.suggestButtonText}>Suggest Examination</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.examForm}>
                  <Text style={styles.helperText}>Enter examination details for the patient (lab name, tests, notes)</Text>
                  <TextInput
                    style={styles.examInput}
                    placeholder="e.g., CBC, Liver function tests"
                    placeholderTextColor="#9CA3AF"
                    value={examText}
                    onChangeText={setExamText}
                    multiline
                    numberOfLines={3}
                    editable={!sendingExam}
                  />

                  <Text style={[styles.subLabel, { marginTop: 8 }]}>Choose lab</Text>
                  <View style={styles.labList}>
                    {(labs && labs.length ? labs : DEMO_LABS).map((lab) => (
                      <TouchableOpacity
                        key={lab.id}
                        style={[styles.labItem, String(selectedLab) === String(lab.id) && styles.labItemSelected]}
                        onPress={() => setSelectedLab(lab.id)}
                        disabled={sendingExam}
                      >
                        <Text style={[styles.labText, String(selectedLab) === String(lab.id) && styles.labTextSelected]}>{lab.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={[styles.subLabel, { marginTop: 8 }]}>Schedule (optional)</Text>
                  <View style={styles.scheduleRow}>
                    <TextInput
                      style={[styles.inputSmall]}
                      placeholder="YYYY-MM-DD"
                      value={scheduledDate}
                      onChangeText={setScheduledDate}
                      editable={!sendingExam}
                    />
                    <TextInput
                      style={[styles.inputSmall, { marginLeft: 8 }]}
                      placeholder="HH:MM"
                      value={scheduledTime}
                      onChangeText={setScheduledTime}
                      editable={!sendingExam}
                    />
                  </View>

                  <View style={styles.formRow}>
                    <TouchableOpacity style={[styles.sendButton, sendingExam && styles.disabledButton]} onPress={handleSendExamination} disabled={sendingExam}>
                      <Text style={styles.sendButtonText}>{sendingExam ? 'Sending…' : 'Send to Patient'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowExamForm(false); setExamText(''); setScheduledDate(''); setScheduledTime(''); }} disabled={sendingExam}>
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={styles.bookingSection}>
            <View style={styles.bookingHeader}>
              <Ionicons name="calendar" size={20} color="#0b61c6" />
              <Text style={styles.bookingTitle}>Need support? Book a session</Text>
            </View>

            {therapists.length > 0 ? (
              <View style={styles.therapistList}>
                {therapists.slice(0, 3).map((therapist) => (
                  <View key={`therapist-${therapist.id}`} style={styles.therapistCard}>
                    <View style={styles.therapistInfo}>
                      <View style={styles.therapistAvatar}>
                        <Ionicons name="person-circle" size={32} color="#6b4fd9" />
                      </View>
                      <View style={styles.therapistDetails}>
                        <Text style={styles.therapistName}>{therapist.name}</Text>
                        <Text style={styles.therapistSpecialization}>
                          {therapist.specialization || 'Therapist'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.bookButton}
                      onPress={() => handleBookAppointment(therapist)}
                    >
                      <Text style={styles.bookButtonText}>Book</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noTherapistsText}>No therapists available.</Text>
            )}
          </View>

          <TouchableOpacity style={styles.exportButton}>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={styles.exportButtonText}>Export PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareButton}>
            <Ionicons name="share-social-outline" size={18} color="#0b61c6" />
            <Text style={styles.shareButtonText}>Share Results</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => navigation?.goBack()}
          >
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4d3728',
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  scroll: {
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 28,
    backgroundColor: '#fff',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  backButton: {
    padding: 8,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  backButtonLarge: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#0b61c6',
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  scoreSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#e8f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: '#0b61c6',
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#0b61c6',
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a4a4a',
    marginTop: 4,
  },
  scoreDescription: {
    fontSize: 13,
    color: '#6b6d80',
    textAlign: 'center',
    lineHeight: 18,
  },
  examinationSection: {
    backgroundColor: '#eef6ff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  suggestButton: {
    backgroundColor: '#0b61c6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  suggestButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  examForm: {
    marginTop: 8,
  },
  examInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#fff',
    color: '#111827',
    marginBottom: 8,
  },
  labList: { flexDirection: 'row', marginTop: 6 },
  labItem: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginRight: 8, backgroundColor: '#fff' },
  labItemSelected: { backgroundColor: '#0b61c6', borderColor: '#0b61c6' },
  labText: { color: '#111827', fontWeight: '600' },
  labTextSelected: { color: '#fff' },
  scheduleRow: { flexDirection: 'row', marginTop: 6 },
  inputSmall: { flex: 1, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 8, backgroundColor: '#fff' },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sendButton: {
    backgroundColor: '#0b61c6',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  adviceSection: {
    backgroundColor: '#f9fafc',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  adviceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#161616',
    marginLeft: 8,
  },
  adviceIntro: {
    fontSize: 12,
    color: '#6b6d80',
    marginBottom: 12,
    lineHeight: 16,
  },
  actionsList: {
    marginTop: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  actionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0b61c6',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '700',
    marginRight: 10,
    fontSize: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 12,
    color: '#4a4a4a',
    lineHeight: 16,
  },
  bookingSection: {
    backgroundColor: '#f5f1eb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#161616',
    marginLeft: 8,
  },
  therapistList: {
    gap: 10,
  },
  therapistCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e3e6f0',
  },
  therapistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  therapistAvatar: {
    marginRight: 10,
  },
  therapistDetails: {
    flex: 1,
  },
  therapistName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#161616',
  },
  therapistSpecialization: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 2,
  },
  bookButton: {
    backgroundColor: '#0b61c6',
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  noTherapistsText: {
    fontSize: 12,
    color: '#8c8c8c',
    textAlign: 'center',
    paddingVertical: 16,
  },
  exportButton: {
    backgroundColor: '#000',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  shareButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#0b61c6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  shareButtonText: {
    color: '#0b61c6',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  homeButton: {
    backgroundColor: '#e8f0ff',
    borderWidth: 1,
    borderColor: '#0b61c6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#0b61c6',
    fontSize: 13,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 15,
    color: '#e02a3f',
  },
});
