import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, SafeAreaView, FlatList, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthContext from '../context/AuthContext';
import { messageApi } from '../api';

export default function ChatThread({ route, navigation }) {
  const { therapistId, userId } = route.params || {};
  const { user } = React.useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  const load = useCallback(async () => {
    if (!therapistId || !userId) return;
    setLoading(true);
    try {
      const resp = await messageApi.getMessages(userId, therapistId);
      setMessages(Array.isArray(resp.data) ? resp.data : []);
      setTimeout(() => listRef.current?.scrollToEnd && listRef.current.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      console.warn('Failed to load conversation', e);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [therapistId, userId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!text.trim() || !therapistId || !userId) return;
    const senderType = (user?.user_type === 'therapist') ? 'therapist' : 'user';
    const payload = { user_id: userId, therapist_id: therapistId, sender_type: senderType, content: text.trim() };
    try {
      await messageApi.sendMessage(payload);
      setText('');
      load();
    } catch (e) {
      console.warn('Failed to send message', e);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#0b61c6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const isTherapist = item.sender_type === 'therapist';
            const align = isTherapist ? 'flex-start' : 'flex-end';
            const bg = isTherapist ? '#eef2ff' : '#d1fae5';
            return (
              <View style={{ marginVertical: 6, alignSelf: align, maxWidth: '85%' }}>
                <View style={{ backgroundColor: bg, padding: 10, borderRadius: 12 }}>
                  <Text>{item.content}</Text>
                </View>
                <Text style={{ marginTop: 4, fontSize: 11, color: '#888' }}>{item.created_at}</Text>
              </View>
            );
          }}
        />
        <View style={styles.composer}>
          <TextInput value={text} onChangeText={setText} placeholder="Write a message" style={styles.input} />
          <TouchableOpacity style={styles.send} onPress={handleSend}><Text style={{ color: '#fff' }}>Send</Text></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#000' },
  composer: { flexDirection: 'row', padding: 8, borderTopWidth: 1, borderColor: '#eee', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f7f7f8', padding: 12, borderRadius: 20, marginRight: 8 },
  send: { backgroundColor: '#0b61c6', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 }
});