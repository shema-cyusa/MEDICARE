import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthContext from '../context/AuthContext';
import { messageApi } from '../api';
import { useNavigation } from '@react-navigation/native';

export default function Messages() {
  const { user } = useContext(AuthContext);
  const userId = user?.id;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (user.user_type === 'therapist') {
        const resp = await messageApi.getForTherapist(user.id);
        setMessages(Array.isArray(resp.data) ? resp.data : []);
      } else {
        const resp = await messageApi.getForUser(userId);
        setMessages(Array.isArray(resp.data) ? resp.data : []);
      }
    } catch (e) {
      console.warn('Failed to load messages', e);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [user, userId]);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.panelHeader}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Messages</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={load}>
          <Ionicons name="refresh" size={16} color="#0b1c3d" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.cardGroup}>
          {loading ? (
            <ActivityIndicator size="large" />
          ) : messages.length === 0 ? (
            <Text style={{ color: '#fff' }}>No messages</Text>
          ) : messages.map((message) => {
            // therapist: message represents a conversation row with user_id
            if (user.user_type === 'therapist') {
              return (
                <View key={`c-${message.user_id}`} style={styles.messageCard}>
                  <View style={styles.messageHeader}>
                    <View style={styles.messageMeta}>
                      <Ionicons name="people-circle" size={22} color="#64f7ff" />
                      <View style={styles.messageLabelGroup}>
                        <Text style={styles.messageLabel}>Conversation</Text>
                        <Text style={styles.messageName}>{message.user_name || `User ${message.user_id}`}</Text>
                      </View>
                    </View>
                    <Text style={styles.messageTimestamp}>{message.last_at}</Text>
                  </View>
                  <Text style={styles.messageBody}>{message.last_message}</Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('ChatThread', { userId: message.user_id, therapistId: user.id })}>
                      <Text style={styles.primaryText}>Open</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }

            // patient view: message rows are individual messages
            return (
              <View key={message.id} style={styles.messageCard}>
                <View style={styles.messageHeader}>
                  <View style={styles.messageMeta}>
                    <Ionicons
                      name={message.sender_type === 'therapist' ? 'people-circle' : 'chatbubbles'}
                      size={22}
                      color="#64f7ff"
                    />
                    <View style={styles.messageLabelGroup}>
                      <Text style={styles.messageLabel}>{message.sender_type === 'therapist' ? `From therapist` : 'Message'}</Text>
                      <Text style={styles.messageName}>{message.therapist_name || message.person || 'Therapist'}</Text>
                    </View>
                  </View>
                  <Text style={styles.messageTimestamp}>{message.created_at}</Text>
                </View>
                <Text style={styles.messageBody}>{message.content}</Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('ChatThread', { userId: userId, therapistId: message.therapist_id })}>
                    <Text style={styles.primaryText}>Open</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.outlineButton}>
                    <Text style={styles.outlineText}>Send</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#040d20',
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0d1a36',
    backgroundColor: '#040d20',
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    flex: 1,
    textAlign: 'left',
  },
  backButton: {
    padding: 6,
    marginRight: 8,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
  },
  refreshText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#0b1c3d',
  },
  scroll: {
    padding: 18,
    paddingBottom: 32,
    backgroundColor: '#040d20',
  },
  cardGroup: {
    paddingTop: 12,
  },
  messageCard: {
    backgroundColor: '#0d1b3a',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#17324c',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    marginBottom: 12,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageLabelGroup: {
    marginLeft: 10,
  },
  messageLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: '#93c5ff',
  },
  messageName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  messageTimestamp: {
    fontSize: 12,
    color: '#9bb3d7',
  },
  messageBody: {
    fontSize: 15,
    color: '#fff',
    marginBottom: 16,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#08c6ff',
    borderRadius: 18,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0b1c3d',
  },
  outlineButton: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#64f7ff',
    paddingVertical: 10,
    alignItems: 'center',
    marginLeft: 10,
  },
  outlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64f7ff',
  },
});
