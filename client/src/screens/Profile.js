import React, { useContext, useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Image,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import AuthContext from '../context/AuthContext';
import { therapistApi } from '../api';

const DEFAULT_AVATAR = require('../../assets/icon.png');

export default function Profile({ navigation }) {
  const { logout } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [therapistId, setTherapistId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [form, setForm] = useState({
    email: '',
    name: '',
    phone: '',
    specialization: '',
    bio: '',
    availability: '',
  });

  useEffect(() => {
    const init = async () => {
      try {
        const authData = await AsyncStorage.getItem('authToken');
        if (!authData) {
          setLoading(false);
          return;
        }
        const parsed = JSON.parse(authData);
        const tid = parsed.therapist_id || parsed.id;
        if (!tid) {
          setLoading(false);
          return;
        }
        setTherapistId(tid);
        await loadProfile(tid);
      } catch (error) {
        console.warn('Profile init failed', error);
        Alert.alert('Error', 'Unable to load your profile.');
        setLoading(false);
      }
    };

    init();
  }, []);

  const loadProfile = async (id) => {
    setLoading(true);
    try {
      const resp = await therapistApi.getProfile(id);
      const data = resp.data;
      setProfile(data);
      setForm((prev) => ({
        ...prev,
        email: data.email || '',
        name: data.name || '',
        phone: data.phone || '',
        specialization: data.specialization || '',
        bio: data.bio || '',
        availability: formatAvailability(data.availability_json),
      }));
    } catch (error) {
      console.warn('Profile load failed', error);
      Alert.alert('Error', 'Unable to fetch profile data.');
    } finally {
      setLoading(false);
    }
  };

  const formatAvailability = (raw) => {
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return raw;
    }
  };

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Allow access to your photo library to change your profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      Alert.alert('Upload error', 'Unable to read this photo. Please choose another image.');
      return;
    }
    const extension = asset.fileName?.split('.').pop()?.toLowerCase();
    const mimeType =
      asset.mimeType || (extension === 'png' ? 'image/png' : extension === 'gif' ? 'image/gif' : 'image/jpeg');
    setSelectedAvatar({ uri: asset.uri, dataUri: `data:${mimeType};base64,${asset.base64}` });
  };

  const handleSave = async () => {
    if (!therapistId) {
      Alert.alert('Error', 'Therapist ID missing.');
      return;
    }

    let availabilityPayload;
    if (form.availability.trim()) {
      try {
        availabilityPayload = JSON.parse(form.availability);
      } catch (e) {
        Alert.alert('Invalid availability', 'Availability must be valid JSON.');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        email: form.email,
        name: form.name,
        phone: form.phone,
        specialization: form.specialization,
        bio: form.bio,
        availability: availabilityPayload,
        ...(selectedAvatar?.dataUri ? { avatar_url: selectedAvatar.dataUri } : {}),
      };
      const resp = await therapistApi.updateProfile(therapistId, payload);
      const updated = resp.data;
      setProfile(updated);
      setSelectedAvatar(null);
      setForm((prev) => ({
        ...prev,
        email: updated.email || prev.email,
        name: updated.name || prev.name,
        phone: updated.phone || prev.phone,
        specialization: updated.specialization || prev.specialization,
        bio: updated.bio || prev.bio,
        availability: formatAvailability(updated.availability_json),
      }));
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (error) {
      console.warn('Profile save failed', error);
      const message = error?.response?.data?.error || 'Failed to save profile.';
      Alert.alert('Error', message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoutPress = async () => {
    try {
      await logout();
      const rootNav = navigation?.getParent()?.getParent()?.getParent();
      if (rootNav) {
        rootNav.reset({ index: 0, routes: [{ name: 'Welcome' }] });
      }
    } catch (error) {
      console.warn('Logout failed', error);
      Alert.alert('Error', 'Unable to log out right now.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <TouchableOpacity style={styles.avatarWrapper} onPress={handlePickAvatar} activeOpacity={0.8}>
            <View style={styles.avatarContainer}>
              <Image
                source={
                  selectedAvatar?.uri
                    ? { uri: selectedAvatar.uri }
                    : profile?.avatar_url
                    ? { uri: profile.avatar_url }
                    : DEFAULT_AVATAR
                }
                style={styles.avatar}
                resizeMode="cover"
              />
            </View>
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditIcon}>📷</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{profile?.name || 'Therapist'}</Text>
          <Text style={styles.subtitle}>Therapist Profile</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={form.name}
              onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={form.phone}
              onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Specialization</Text>
            <TextInput
              style={styles.input}
              value={form.specialization}
              onChangeText={(value) => setForm((prev) => ({ ...prev, specialization: value }))}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Bio</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={form.bio}
              onChangeText={(value) => setForm((prev) => ({ ...prev, bio: value }))}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Availability (JSON)</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={form.availability}
              onChangeText={(value) => setForm((prev) => ({ ...prev, availability: value }))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              placeholder='{"days":["Monday","Tuesday"],"slots":["09:00","14:00"]}'
            />
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogoutPress}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2ebe1' },
  scroll: { paddingHorizontal: 16, paddingVertical: 24, alignItems: 'center' },
  card: {
    backgroundColor: '#fff',
    width: '100%',
    maxWidth: 480,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
    alignItems: 'center',
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#f2ebe1',
  },
  avatarWrapper: {
    marginBottom: 12,
    position: 'relative',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#f0a500',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarEditIcon: { fontSize: 14 },
  avatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e0e0e0',
  },
  name: { fontSize: 22, fontWeight: '700', color: '#222' },
  subtitle: { fontSize: 14, color: '#777', marginBottom: 24 },
  formGroup: { width: '100%', marginBottom: 16 },
  label: { fontSize: 12, color: '#8d8d8d', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#e3dfd8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fbfbfb',
    color: '#222',
  },
  multiline: { minHeight: 70 },
  saveButton: {
    marginTop: 8,
    backgroundColor: '#f0a500',
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  logoutButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#f0a500',
    borderRadius: 12,
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutButtonText: { color: '#f0a500', fontSize: 16, fontWeight: '600' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});