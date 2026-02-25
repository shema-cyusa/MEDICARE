import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, FlatList, TouchableOpacity, Modal } from 'react-native';
import axios from 'axios';

const API_BASE = 'http://localhost:4000';

export default function LabNotifications({ route }) {
  const { labId, token } = route.params || {};
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const loadNotifications = async () => {
      setLoading(true);
      try {
        const resp = await axios.get(`${API_BASE}/api/labs/${labId}/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotifications(resp.data?.notifications || []);
      } catch (e) {
        console.error('Failed to load notifications', e);
      } finally {
        setLoading(false);
      }
    };

    if (labId && token) {
      loadNotifications();
      // Poll every 10 seconds
      const interval = setInterval(loadNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [labId, token]);

  const handleViewNotification = (notification) => {
    // Parse payload_json if it exists
    const notificationData = {
      ...notification,
      data: notification.payload_json ? JSON.parse(notification.payload_json) : null
    };
    setSelectedNotification(notificationData);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedNotification(null);
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
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No notifications</Text>
        </View>
      ) : (
        <View style={styles.notificationsContainer}>
          {notifications.map((n, idx) => (
            <View key={idx} style={styles.notificationItem}>
              <View style={styles.notifIcon}>
                <Text style={styles.notifIconText}>🔔</Text>
              </View>
              <View style={styles.notifContent}>
                <Text style={styles.notifType}>{n.type}</Text>
                <Text style={styles.notifTime}>
                  {new Date(n.created_at).toLocaleString()}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.viewButton}
                onPress={() => handleViewNotification(n)}
              >
                <Text style={styles.viewButtonText}>View</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Modal for viewing notification details */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notification Details</Text>
              <TouchableOpacity onPress={closeModal}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedNotification && (
              <ScrollView style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Type:</Text>
                  <Text style={styles.detailValue}>{selectedNotification.type}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Date & Time:</Text>
                  <Text style={styles.detailValue}>
                    {new Date(selectedNotification.created_at).toLocaleString()}
                  </Text>
                </View>

                {selectedNotification.data && (
                  <>
                    {selectedNotification.data.patient_name && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>Patient Name:</Text>
                        <Text style={styles.detailValue}>{selectedNotification.data.patient_name}</Text>
                      </View>
                    )}

                    {selectedNotification.data.therapist_name && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>Therapist Name:</Text>
                        <Text style={styles.detailValue}>{selectedNotification.data.therapist_name}</Text>
                      </View>
                    )}

                    {selectedNotification.data.patient_email && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>Patient Email:</Text>
                        <Text style={styles.detailValue}>{selectedNotification.data.patient_email}</Text>
                      </View>
                    )}

                    {selectedNotification.data.therapist_email && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>Therapist Email:</Text>
                        <Text style={styles.detailValue}>{selectedNotification.data.therapist_email}</Text>
                      </View>
                    )}

                    {selectedNotification.data.assignment_id && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>Assignment ID:</Text>
                        <Text style={styles.detailValue}>{selectedNotification.data.assignment_id}</Text>
                      </View>
                    )}

                    {selectedNotification.data.exam_details && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailLabel}>Examination Details:</Text>
                        {selectedNotification.data.exam_details.kind && (
                          <Text style={styles.detailValue}>
                            <Text style={{ fontWeight: '600' }}>Kind: </Text>
                            {selectedNotification.data.exam_details.kind}
                          </Text>
                        )}
                        {selectedNotification.data.exam_details.examination && (
                          <Text style={[styles.detailValue, { marginTop: 8 }]}>
                            <Text style={{ fontWeight: '600' }}>Examination: </Text>
                            {selectedNotification.data.exam_details.examination}
                          </Text>
                        )}
                        {selectedNotification.data.exam_details.assessment_id && (
                          <Text style={[styles.detailValue, { marginTop: 8 }]}>
                            <Text style={{ fontWeight: '600' }}>Assessment ID: </Text>
                            {selectedNotification.data.exam_details.assessment_id}
                          </Text>
                        )}
                        {selectedNotification.data.exam_details.lab_id && (
                          <Text style={[styles.detailValue, { marginTop: 8 }]}>
                            <Text style={{ fontWeight: '600' }}>Lab ID: </Text>
                            {selectedNotification.data.exam_details.lab_id}
                          </Text>
                        )}
                        {selectedNotification.data.exam_details.lab_name && (
                          <Text style={[styles.detailValue, { marginTop: 8 }]}>
                            <Text style={{ fontWeight: '600' }}>Lab Name: </Text>
                            {selectedNotification.data.exam_details.lab_name}
                          </Text>
                        )}
                        {selectedNotification.data.exam_details.scheduled_at && (
                          <Text style={[styles.detailValue, { marginTop: 8 }]}>
                            <Text style={{ fontWeight: '600' }}>Scheduled: </Text>
                            {new Date(selectedNotification.data.exam_details.scheduled_at).toLocaleString()}
                          </Text>
                        )}
                        {selectedNotification.data.exam_details.tests && (
                          <Text style={[styles.detailValue, { marginTop: 8 }]}>
                            <Text style={{ fontWeight: '600' }}>Tests: </Text>
                            {selectedNotification.data.exam_details.tests}
                          </Text>
                        )}
                        {selectedNotification.data.exam_details.notes && (
                          <Text style={[styles.detailValue, { marginTop: 8 }]}>
                            <Text style={{ fontWeight: '600' }}>Notes: </Text>
                            {selectedNotification.data.exam_details.notes}
                          </Text>
                        )}
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
            )}

            <TouchableOpacity 
              style={styles.closeModalButton}
              onPress={closeModal}
            >
              <Text style={styles.closeModalButtonText}>Close</Text>
            </TouchableOpacity>
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
  notificationsContainer: {
    padding: 16,
  },
  notificationItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#4A90E2',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifIconText: {
    fontSize: 20,
  },
  notifContent: {
    flex: 1,
  },
  notifType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  notifTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  viewButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  viewButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  closeModalButton: {
    backgroundColor: '#4A90E2',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeModalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
