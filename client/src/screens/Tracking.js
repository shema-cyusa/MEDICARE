import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AuthContext from '../context/AuthContext';
import { moodApi } from '../api';

const MOODS = ['Happy', 'Calm', 'Neutral', 'Sad', 'Angry', 'Stressed'];

export default function TrackingScreen() {
  const { user } = useContext(AuthContext);
  const userId = user?.id;
  const navigation = useNavigation();
  const [selectedMood, setSelectedMood] = useState(null);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const resp = await moodApi.getByUser(userId);
      const entries = Array.isArray(resp.data) ? resp.data : [];
      setHistory(entries.slice(0, 5));
    } catch (e) {
      console.warn('Failed to load mood history', e);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const handleSave = async () => {
    if (!userId || !selectedMood) {
      Alert.alert('Error', 'Please select a mood');
      return;
    }
    setSaving(true);
    try {
      await moodApi.create({
        user_id: userId,
        mood: selectedMood,
        note: `${label}${notes ? ' - ' + notes : ''}`,
      });
      Alert.alert('Success', 'Mood entry saved!');
      setSelectedMood(null);
      setLabel('');
      setNotes('');
      loadHistory();
    } catch (e) {
      console.warn('Failed to save mood', e);
      Alert.alert('Error', 'Failed to save mood entry');
    } finally {
      setSaving(false);
    }
  };

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} scrollEnabled={false}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <View style={styles.headerTitle}>
              <Text style={styles.title}>Mood Tracker</Text>
              <Text style={styles.subtitle}>Mood Tracker Entry — {dateStr}</Text>
            </View>
            <TouchableOpacity style={styles.homePill} onPress={() => navigation.navigate('UserDashboard')}>
              <Text style={styles.homeText}>Home</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.entryRow}>
            <Text style={styles.entryLabel}>Entry</Text>
            <Text style={styles.entryDate}>{dateStr}</Text>
          </View>
          <Text style={styles.timeText}>Time: <Text style={styles.timeValue}>{timeStr}</Text></Text>

          <Text style={styles.sectionHeading}>Mood Selected:</Text>
          <View style={styles.moodGroup}>
            {MOODS.map((mood) => (
              <TouchableOpacity
                key={mood}
                style={[
                  styles.moodButton,
                  selectedMood === mood && styles.moodButtonActive,
                ]}
                onPress={() => setSelectedMood(mood)}
              >
                <Text
                  style={[
                    styles.moodText,
                    selectedMood === mood && styles.moodTextActive,
                  ]}
                >
                  {mood}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.sectionHeading}>Mood Label:</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Feeling calm and balanced"
            placeholderTextColor="#b1b1b1"
            value={label}
            onChangeText={setLabel}
          />

          <Text style={styles.sectionHeading}>Notes:</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="e.g. Took a walk this morning and did some journaling."
            placeholderTextColor="#b1b1b1"
            multiline
            value={notes}
            onChangeText={setNotes}
          />

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Entry'}</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionHeading, styles.historyHeading]}>Mood History Preview (past 5 entries):</Text>
          {loading ? (
            <ActivityIndicator />
          ) : history.length === 0 ? (
            <Text style={{ color: '#999' }}>No mood entries yet</Text>
          ) : history.map((entry, idx) => (
            <View style={styles.historyRow} key={idx}>
              <Text style={styles.historyDate}>{new Date(entry.created_at).toLocaleDateString()}</Text>
              <Text style={styles.historyMood}>{entry.mood}</Text>
            </View>
          ))}

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status:</Text>
            <Text style={styles.statusValue}>Ready to log mood</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    paddingHorizontal: 18,
    paddingBottom: 40,
    backgroundColor: '#ffffff',
  },
  card: {
    marginTop: 16,
    borderRadius: 28,
    backgroundColor: '#fff',
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d8d1c6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  backText: {
    fontSize: 18,
    color: '#2c2c2c',
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1b1b1f',
  },
  subtitle: {
    fontSize: 12,
    color: '#7a7a7a',
  },
  homePill: {
    backgroundColor: '#f0f0f0',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  homeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333333',
  },
  entryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  entryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1b1b1f',
  },
  entryDate: {
    fontSize: 12,
    color: '#6d6d74',
  },
  timeText: {
    fontSize: 12,
    color: '#4d4d51',
    marginBottom: 10,
  },
  timeValue: {
    fontWeight: '700',
    color: '#1b1b1f',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1b1b1f',
    marginBottom: 6,
  },
  moodGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  moodButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d0c7ba',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
  },
  moodButtonActive: {
    backgroundColor: '#d4c1ff',
    borderColor: '#b19def',
  },
  moodText: {
    fontSize: 12,
    color: '#4a4a4a',
    fontWeight: '600',
  },
  moodTextActive: {
    color: '#2b1f5d',
  },
  input: {
    borderWidth: 1,
    borderColor: '#dddfe6',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    fontSize: 14,
    color: '#2c2c2c',
    backgroundColor: '#f9f7f3',
  },
  notesInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginBottom: 16,
    backgroundColor: '#091b33',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  historyHeading: {
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#ecedea',
  },
  historyDate: {
    fontSize: 12,
    color: '#4d4d4d',
  },
  historyMood: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4d4d4d',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  statusLabel: {
    fontSize: 12,
    color: '#7e7e7f',
    marginRight: 6,
  },
  statusValue: {
    fontSize: 12,
    color: '#2ba82b',
    fontWeight: '700',
  },
});