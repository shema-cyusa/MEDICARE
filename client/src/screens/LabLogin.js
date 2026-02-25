import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import axios from 'axios';

const API_BASE = 'http://localhost:4000';

export default function LabLogin({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [labs, setLabs] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLabs = async () => {
      try {
        const resp = await axios.get(`${API_BASE}/api/labs`);
        console.log('Fetched labs:', resp.data);
        setLabs(resp.data || []);
      } catch (e) {
        console.error('Failed to fetch labs', e);
        setError('Failed to load labs. Check server connection.');
      }
    };
    fetchLabs();
  }, []);

  const handleLogin = async () => {
    setError('');
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }

    if (labs.length === 0) {
      setError('Labs not loaded yet. Please try again.');
      return;
    }

    setLoading(true);
    try {
      // Find lab by email or name
      const lab = labs.find(
        (l) =>
          (l.contact_info && l.contact_info.toLowerCase() === email.toLowerCase()) ||
          (l.name && l.name.toLowerCase() === email.toLowerCase())
      );

      console.log('Email entered:', email);
      console.log('Labs available:', labs);
      console.log('Lab found:', lab);

      if (!lab) {
        setError('Lab not found for that email. Check demo credentials below.');
        setLoading(false);
        return;
      }

      // Call lab login API
      const loginResp = await axios.post(`${API_BASE}/api/labs/login`, {
        lab_id: lab.id,
        password: password,
      });

      if (loginResp.data && loginResp.data.token) {
        // Navigate to LabDashboard with lab info
        navigation.navigate('LabDashboard', {
          labId: lab.id,
          labName: lab.name,
          labEmail: lab.contact_info,
          token: loginResp.data.token,
        });
      }
    } catch (e) {
      const errMsg = e.response?.data?.error || e.message || 'Login failed';
      setError(errMsg);
      Alert.alert('Login Failed', errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Lab Portal Login</Text>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Lab Email</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., acme@example.com"
            value={email}
            onChangeText={setEmail}
            editable={!loading}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Demo Lab Credentials:</Text>
          {labs.map((lab) => (
            <Text key={lab.id} style={styles.demoItem}>
              • {lab.name}: {lab.contact_info}
            </Text>
          ))}
          <Text style={styles.demoItem}>Password: labpass</Text>
        </View>

        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backLink}>Back to Welcome</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
    color: '#333',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  button: {
    backgroundColor: '#1A1A1A',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 13,
    marginTop: 10,
  },
  demoBox: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  demoTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    color: '#333',
  },
  demoItem: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  backLink: {
    marginTop: 16,
    textAlign: 'center',
    color: '#4A90E2',
    fontSize: 14,
    fontWeight: '500',
  },
});
