import React, { useContext, useMemo, useState } from 'react';
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
import AuthContext from '../context/AuthContext';
import { communityApi } from '../api';

export default function CommunityCreate() {
  const { user } = useContext(AuthContext);
  const therapistId = useMemo(() => user?.therapist_id || user?.id, [user]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Community name is required.');
      return;
    }
    if (!therapistId) {
      Alert.alert('Profile required', 'Unable to identify your therapist profile.');
      return;
    }

    setCreating(true);
    try {
      await communityApi.create({
        therapist_id: therapistId,
        name: name.trim(),
        description: description.trim(),
      });
      Alert.alert('Success', 'Community created successfully.');
      setName('');
      setDescription('');
    } catch (error) {
      console.warn('Failed to create community', error);
      const message = error?.response?.data?.error || 'Failed to create community. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setCreating(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FFF" />
          <Text style={styles.loadingText}>Loading your profile…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (user?.user_type !== 'therapist') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Only therapists can create communities.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.cardWrapper}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Create Community</Text>
            <Text style={styles.description}>Build a safe space for your clients and team members.</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Community Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mindfulness Circle"
                placeholderTextColor="#b1aea5"
                value={name}
                onChangeText={setName}
                editable={!creating}
                returnKeyType="done"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description (optional)</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                placeholder="Share what the community is about"
                placeholderTextColor="#b1aea5"
                value={description}
                onChangeText={setDescription}
                editable={!creating}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.button, creating && styles.buttonDisabled]}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 42,
    backgroundColor: '#ffffff',
  },
  cardWrapper: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 34,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    borderWidth: 1,
    borderColor: '#e6e1d8',
  },
  card: {
    width: '100%',
    borderRadius: 32,
    padding: 28,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1d1d1f',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#5c5650',
    marginBottom: 22,
  },
  formGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#8d8680',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e3dfd8',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#faf9f7',
    fontSize: 16,
    color: '#1d1d1f',
  },
  multiline: {
    minHeight: 110,
  },
  button: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 24,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#fff',
    fontSize: 14,
  },
  errorText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});