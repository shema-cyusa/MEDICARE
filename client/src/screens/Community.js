import React, { useCallback, useContext, useEffect, useState, useRef } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthContext from '../context/AuthContext';
import { communityApi } from '../api';
import { useNavigation } from '@react-navigation/native';

export default function CommunityScreen({ onSelectCommunity }) {
  const { user } = useContext(AuthContext);
  const userId = user?.id;
  const navigation = useNavigation();
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [joinedCommunities, setJoinedCommunities] = useState(new Set());
  const joiningRef = useRef(new Set());

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const resp = await communityApi.getAll();
      const all = Array.isArray(resp.data) ? resp.data : [];
      setCommunities(all);
      // Track which communities the user has joined
      const joined = new Set(
        all.filter(c => c.is_member === 1 || c.joined === true).map(c => c.id)
      );
      setJoinedCommunities(joined);
    } catch (e) {
      console.warn('Failed to load communities', e);
      setCommunities([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleJoin = async (communityId) => {
    if (!userId) return;
    // Check synchronously using ref to prevent race conditions
    if (joiningRef.current.has(communityId) || joinedCommunities.has(communityId)) {
      return;
    }
    joiningRef.current.add(communityId);
    try {
      await communityApi.join(communityId, { user_id: userId });
      Alert.alert('Success', 'You have joined the community');
      setJoinedCommunities(prev => new Set([...prev, communityId]));
      load();
    } catch (e) {
      const status = e?.response?.status;
      if (status === 409) {
        Alert.alert('Info', 'You are already a member of this community');
        setJoinedCommunities(prev => new Set([...prev, communityId]));
      } else {
        console.warn('Failed to join community', e?.response?.data || e.message);
        Alert.alert('Error', e?.response?.data?.error || 'Failed to join community');
      }
    } finally {
      joiningRef.current.delete(communityId);
    }
  };

  const handleExplore = (community) => {
    if (onSelectCommunity) {
      onSelectCommunity(community);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Text style={styles.backText}>←</Text>
            </TouchableOpacity>
            <View style={styles.headerTitle}>
              <Text style={styles.title}>Peer group and community</Text>
              <Text style={styles.subtitle}>Meet your own support groups</Text>
            </View>
            <TouchableOpacity style={styles.homePill} onPress={() => navigation.navigate('UserDashboard')}>
              <Text style={styles.homeText}>Home</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.groupList}>
            {loading ? (
              <ActivityIndicator size="large" />
            ) : communities.length === 0 ? (
              <Text style={{ color: '#999' }}>No communities available</Text>
            ) : communities.map((community) => (
              <View style={styles.groupCard} key={community.id}>
                <View style={styles.groupHeader}>
                  <Ionicons name="people" size={20} color="#6b4fd9" />
                  <View style={styles.groupText}>
                    <Text style={styles.groupTitle}>{community.name}</Text>
                    <Text style={styles.groupOwner}>by {community.therapist_id || 'Therapist'}</Text>
                  </View>
                </View>
                <Text style={styles.groupDescription}>{community.description || 'No description'}</Text>
                <Text style={styles.groupMembers}>{community.members || 0} members</Text>
                <View style={styles.buttonRow}>
                  <TouchableOpacity 
                    style={[styles.joinButton, joinedCommunities.has(community.id) && styles.joinedButton]} 
                    onPress={() => handleJoin(community.id)}
                    disabled={joinedCommunities.has(community.id) || joiningRef.current.has(community.id)}
                  >
                    <Text style={[styles.joinText, joinedCommunities.has(community.id) && styles.joinedText]}>
                      {joiningRef.current.has(community.id) ? 'Joining...' : (joinedCommunities.has(community.id) ? 'Joined' : 'Join')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.exploreButton} onPress={() => handleExplore(community)}>
                    <Text style={styles.exploreText}>Explore</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 40,
    backgroundColor: '#fff',
  },
  card: {
    borderRadius: 28,
    backgroundColor: '#fff',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
    color: '#333',
  },
  groupList: {
    marginTop: 6,
  },
  groupCard: {
    backgroundColor: '#f9f7ff',
    borderRadius: 22,
    padding: 16,
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  groupText: {
    marginLeft: 10,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#321e7b',
  },
  groupOwner: {
    fontSize: 12,
    color: '#8a86a6',
  },
  groupDescription: {
    fontSize: 14,
    color: '#5b5b63',
    marginBottom: 6,
  },
  groupMembers: {
    fontSize: 12,
    color: '#9c9c9c',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
  },
  joinButton: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#f4d6d6',
  },
  joinText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e7536b',
  },
  joinedButton: {
    backgroundColor: '#e7f0ff',
    borderColor: '#b3d9ff',
  },
  joinedText: {
    color: '#0b61c6',
  },
  exploreButton: {
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 24,
    backgroundColor: '#6b4fd9',
  },
  exploreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});