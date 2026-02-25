import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert, ImageBackground } from 'react-native';

const API_BASE_URL = 'http://127.0.0.1:4000';

export default function Signup({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [userType, setUserType] = useState('patient');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!username || !email || !password || !confirm) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: username,
          email,
          password,
          user_type: userType,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        Alert.alert('Error', data.error || 'Signup failed');
        return;
      }
      Alert.alert('Success', 'Account created');
      navigation.replace('Login');
    } catch (error) {
      Alert.alert('Error', error.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ImageBackground source={require('../../assets/background.png')} style={styles.background} resizeMode="cover">
        <View style={styles.overlay} />
        <View style={styles.backArrowContainer}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>{'\u21A9'}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.centerContainer}>
          <View style={styles.card}>
            <Text style={styles.headTitle}>MEDICARE</Text>
            <Text style={styles.welcome}>Welcome</Text>
            <Text style={styles.createText}>Create your account</Text>

            <TextInput
              style={styles.input}
              placeholder="username"
              value={username}
              onChangeText={setUsername}
              editable={!loading}
              placeholderTextColor="#999"
            />
            <TextInput
              style={[styles.input, styles.inputBlue]}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              editable={!loading}
              placeholderTextColor="#7A8BA6"
            />

            <View style={styles.typeSelectorRow}>
              <TouchableOpacity style={[styles.typeBtn, userType === 'patient' && styles.typeBtnActive]} onPress={() => setUserType('patient')}>
                <Text style={[styles.typeBtnText, userType === 'patient' && styles.typeBtnTextActive]}>Patient</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.typeBtn, userType === 'therapist' && styles.typeBtnActive]} onPress={() => setUserType('therapist')}>
                <Text style={[styles.typeBtnText, userType === 'therapist' && styles.typeBtnTextActive]}>Therapist</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, styles.inputBlue]}
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              editable={!loading}
              placeholderTextColor="#7A8BA6"
            />

            <TextInput
              style={styles.input}
              placeholder="confirm"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              editable={!loading}
              placeholderTextColor="#999"
            />

            <TouchableOpacity style={[styles.signupBtn, loading && styles.buttonDisabled]} onPress={handleSignup} disabled={loading}>
              <Text style={styles.signupBtnText}>{loading ? 'Creating...' : 'Signup'}</Text>
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account ? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  background: { flex: 1, width: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  backArrowContainer: { position: 'absolute', top: 18, left: 14 },
  backArrow: { fontSize: 22, color: '#FFF' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#fff', borderRadius: 14, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOffset: { width:0, height:6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
  headTitle: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 6 },
  welcome: { fontSize: 14, fontWeight: '600', color: '#333' },
  createText: { fontSize: 12, color: '#666', marginBottom: 10 },
  input: { width: '100%', backgroundColor: '#F6F2ED', borderRadius: 8, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 10 },
  inputBlue: { backgroundColor: '#EAF4FF' },
  typeSelectorRow: { flexDirection: 'row', width: '100%', marginVertical: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#FFF', borderWidth: 0, alignItems: 'center', marginRight: 8 },
  typeBtnActive: { backgroundColor: '#F2A800' },
  typeBtnText: { color: '#666', fontSize: 14 },
  typeBtnTextActive: { color: '#111', fontWeight: '700' },
  signupBtn: { width: '100%', backgroundColor: '#F2A800', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  signupBtnText: { color: '#111', fontSize: 16, fontWeight: '700' },
  buttonDisabled: { opacity: 0.6 },
  loginRow: { flexDirection: 'row', marginTop: 10 },
  loginText: { color: '#333' },
  loginLink: { color: '#D44', fontWeight: '600', marginLeft: 6 },
});
