import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, TextInput, Modal } from 'react-native';
import axios from 'axios';

const API_BASE = 'http://localhost:4000';

export default function LabAssignments({ route }) {
  const { labId, token } = route.params || {};
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [resultText, setResultText] = useState('');
  const [submittingResult, setSubmittingResult] = useState(false);

  const loadAssignments = async () => {
    setLoading(true);
    try {
      const resp = await axios.get(`${API_BASE}/api/labs/${labId}/assignments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAssignments(resp.data || []);
    } catch (e) {
      console.error('Failed to load assignments', e);
      Alert.alert('Error', 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (labId && token) {
      loadAssignments();
      // Poll every 10 seconds
      const interval = setInterval(loadAssignments, 10000);
      return () => clearInterval(interval);
    }
  }, [labId, token]);

  const handleAcceptAssignment = async (assignmentId) => {
    try {
      await axios.post(
        `${API_BASE}/api/labs/assignments/${assignmentId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Assignment accepted');
      await loadAssignments();
    } catch (e) {
      Alert.alert('Error', 'Failed to accept assignment');
    }
  };

  const handleOpenResultForm = (assignment) => {
    setSelectedAssignment(assignment);
    setResultText('');
    setResultModalVisible(true);
  };

  const handleCloseResultForm = () => {
    setResultModalVisible(false);
    setSelectedAssignment(null);
    setResultText('');
  };

  const handleSubmitResult = async () => {
    if (!resultText.trim()) {
      Alert.alert('Validation', 'Please enter the test results');
      return;
    }

    setSubmittingResult(true);
    try {
      await axios.post(
        `${API_BASE}/api/labs/assignments/${selectedAssignment.id}/results`,
        {
          result_json: resultText,
          uploaded_by: 'lab',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Results submitted successfully');
      await loadAssignments();
      handleCloseResultForm();
    } catch (e) {
      console.error('Failed to submit results', e);
      Alert.alert('Error', 'Failed to submit results');
    } finally {
      setSubmittingResult(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {assignments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No assignments</Text>
        </View>
      ) : (
        <View style={styles.assignmentsContainer}>
          {assignments.map((a) => (
            <View key={a.id} style={styles.assignmentCard}>
              <View style={styles.cardHeader}>
                <Text style={styles.assignmentTitle}>Assignment #{a.id}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    String(a.status).toLowerCase() === 'pending'
                      ? styles.statusPending
                      : styles.statusAccepted,
                  ]}
                >
                  <Text style={styles.statusText}>{a.status}</Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Patient:</Text>
                <Text style={styles.metaValue}>{a.user_name || 'Unknown'}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Therapist:</Text>
                <Text style={styles.metaValue}>{a.therapist_name || 'N/A'}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Assigned:</Text>
                <Text style={styles.metaValue}>
                  {new Date(a.assigned_at).toLocaleString()}
                </Text>
              </View>

              {a.message_content && (
                <View style={styles.contentBox}>
                  <Text style={styles.contentLabel}>Assignment Content:</Text>
                  {(() => {
                    try {
                      const parsed = JSON.parse(a.message_content);
                      return (
                        <View>
                          {parsed.kind && (
                            <Text style={styles.contentDetailText}>
                              <Text style={{ fontWeight: '600' }}>Kind: </Text>
                              {parsed.kind}
                            </Text>
                          )}
                          {parsed.examination && (
                            <Text style={[styles.contentDetailText, { marginTop: 8 }]}>
                              <Text style={{ fontWeight: '600' }}>Examination: </Text>
                              {parsed.examination}
                            </Text>
                          )}
                          {parsed.assessment_id && (
                            <Text style={[styles.contentDetailText, { marginTop: 8 }]}>
                              <Text style={{ fontWeight: '600' }}>Assessment ID: </Text>
                              {parsed.assessment_id}
                            </Text>
                          )}
                          {parsed.lab_id && (
                            <Text style={[styles.contentDetailText, { marginTop: 8 }]}>
                              <Text style={{ fontWeight: '600' }}>Lab ID: </Text>
                              {parsed.lab_id}
                            </Text>
                          )}
                          {parsed.lab_name && (
                            <Text style={[styles.contentDetailText, { marginTop: 8 }]}>
                              <Text style={{ fontWeight: '600' }}>Lab Name: </Text>
                              {parsed.lab_name}
                            </Text>
                          )}
                          {parsed.scheduled_at && (
                            <Text style={[styles.contentDetailText, { marginTop: 8 }]}>
                              <Text style={{ fontWeight: '600' }}>Scheduled: </Text>
                              {new Date(parsed.scheduled_at).toLocaleString()}
                            </Text>
                          )}
                          {parsed.tests && (
                            <Text style={[styles.contentDetailText, { marginTop: 8 }]}>
                              <Text style={{ fontWeight: '600' }}>Tests: </Text>
                              {parsed.tests}
                            </Text>
                          )}
                          {parsed.notes && (
                            <Text style={[styles.contentDetailText, { marginTop: 8 }]}>
                              <Text style={{ fontWeight: '600' }}>Notes: </Text>
                              {parsed.notes}
                            </Text>
                          )}
                        </View>
                      );
                    } catch (e) {
                      return <Text style={styles.contentText}>{a.message_content}</Text>;
                    }
                  })()}
                </View>
              )}

              {String(a.status).toLowerCase() === 'pending' && (
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleAcceptAssignment(a.id)}
                >
                  <Text style={styles.acceptButtonText}>Accept Assignment</Text>
                </TouchableOpacity>
              )}

              {String(a.status).toLowerCase() === 'accepted' && (
                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={() => handleOpenResultForm(a)}
                >
                  <Text style={styles.submitButtonText}>Submit Test Results</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
      
      {/* Result Submission Modal */}
      <Modal
        visible={resultModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={handleCloseResultForm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Test Results</Text>
              <TouchableOpacity onPress={handleCloseResultForm}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedAssignment && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.infoBox}>
                  <Text style={styles.infoLabel}>Assignment ID:</Text>
                  <Text style={styles.infoValue}>{selectedAssignment.id}</Text>
                  
                  <Text style={[styles.infoLabel, { marginTop: 12 }]}>Patient:</Text>
                  <Text style={styles.infoValue}>{selectedAssignment.user_name}</Text>
                  
                  <Text style={[styles.infoLabel, { marginTop: 12 }]}>Therapist:</Text>
                  <Text style={styles.infoValue}>{selectedAssignment.therapist_name}</Text>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Test Results / Answers:</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Enter test results, observations, and findings..."
                    placeholderTextColor="#999"
                    multiline={true}
                    numberOfLines={8}
                    value={resultText}
                    onChangeText={setResultText}
                    editable={!submittingResult}
                  />
                </View>

                <TouchableOpacity 
                  style={[styles.submitResultButton, submittingResult && styles.buttonDisabled]}
                  onPress={handleSubmitResult}
                  disabled={submittingResult}
                >
                  <Text style={styles.submitResultButtonText}>
                    {submittingResult ? 'Submitting...' : 'Submit Results'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={handleCloseResultForm}
                  disabled={submittingResult}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
  assignmentsContainer: {
    padding: 16,
  },
  assignmentCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  assignmentTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#fff3e0',
  },
  statusAccepted: {
    backgroundColor: '#e8f5e9',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  metaLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    width: 70,
  },
  metaValue: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  contentBox: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#4A90E2',
  },
  contentLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  contentText: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  contentDetailText: {
    fontSize: 12,
    color: '#333',
    lineHeight: 18,
  },
  acceptButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#4A90E2',
    borderRadius: 6,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  submitButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  closeButton: {
    fontSize: 24,
    color: '#999',
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
  },
  infoBox: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#4A90E2',
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    marginTop: 4,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 13,
    color: '#333',
    backgroundColor: '#fafafa',
    textAlignVertical: 'top',
    minHeight: 120,
  },
  submitResultButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  submitResultButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
