import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthContext from '../context/AuthContext';
import TrackingScreen from './Tracking';
import CommunityScreen from './Community';
import CommunityDetail from './CommunityDetail';
import ResourcesScreen from './Resources';
import TelehealthScreen from './Telehealth';
import AssessmentsScreen from './Assessments';
import MessagesScreen from './Messages';
import { therapistPostApi, communityApi, messageApi } from '../api';

const NAV_ITEMS = [
  { label: 'Home', icon: 'home' },
  { label: 'Diagnosis', icon: 'clipboard' },
  { label: 'Resources', icon: 'book' },
  { label: 'Telehealth', icon: 'medical' },
  { label: 'Community', icon: 'people' },
  { label: 'Tracking', icon: 'bar-chart' },
  { label: 'Messages', icon: 'chatbubble' },
];

const formatTimestamp = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const getPostTimestamp = (post) => {
  const value = post.created_at ?? post.timestamp;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const getPostKey = (post) => `${post.postType || 'community'}:${post.id}`;

const normalizeCommunityPost = (post, communityName) => ({
  ...post,
  postType: 'community',
  contextLabel: communityName || post.community_name || 'Community',
  postKey: `community:${post.id}`,
});

const normalizeTherapistPost = (post) => ({
  ...post,
  postType: 'therapist',
  contextLabel: post.author_name || 'Therapist',
  postKey: `therapist:${post.id}`,
});

export default function Dashboard({ navigation }) {
  const { logout, user } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('Home');
  const [therapistFeed, setTherapistFeed] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [communities, setCommunities] = useState([]);
  const [loadingCommunities, setLoadingCommunities] = useState(false);
  const [communitiesError, setCommunitiesError] = useState('');
  const [examSuggestions, setExamSuggestions] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentInputVisible, setCommentInputVisible] = useState({});
  const [commentLoading, setCommentLoading] = useState({});
  const [likeLoading, setLikeLoading] = useState({});
  const [joiningCommunities, setJoiningCommunities] = useState({});
  const languages = ['EN', 'RW', 'FR'];

  const loadTherapistFeed = useCallback(async () => {
    if (!user?.id) {
      setTherapistFeed([]);
      setFeedError('');
      return;
    }
    setLoadingFeed(true);
    setFeedError('');
    try {
      const resp = await therapistPostApi.getAll({ user_id: user.id });
      const data = Array.isArray(resp.data) ? resp.data : [];
      const normalized = data.map(normalizeTherapistPost);
      normalized.sort((a, b) => getPostTimestamp(b) - getPostTimestamp(a));
      setTherapistFeed(normalized);
    } catch (error) {
      console.warn('Failed to load therapist posts', error);
      setTherapistFeed([]);
      setFeedError('Failed to load therapist posts.');
    } finally {
      setLoadingFeed(false);
    }
  }, [user?.id]);

  const loadCommunities = useCallback(async () => {
    if (!user?.id) {
      setCommunities([]);
      setCommunitiesError('');
      return;
    }
    setLoadingCommunities(true);
    setCommunitiesError('');
    try {
      const resp = await communityApi.getAll({ user_id: user.id });
      const data = Array.isArray(resp.data) ? resp.data : [];
      setCommunities(data);
    } catch (error) {
      console.warn('Failed to load communities', error);
      setCommunities([]);
      setCommunitiesError('Failed to load communities.');
    } finally {
      setLoadingCommunities(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadTherapistFeed();
    loadCommunities();
    loadExamSuggestions();
  }, [loadTherapistFeed, loadCommunities]);

  const loadExamSuggestions = useCallback(async () => {
    if (!user?.id) {
      setExamSuggestions([]);
      return;
    }
    setLoadingExams(true);
    try {
      const resp = await messageApi.getForUser(user.id);
      const data = Array.isArray(resp.data) ? resp.data : [];
      // Parse content that might be JSON with extra fields
      const parsed = data.map((m) => {
        let parsedContent = null;
        try { parsedContent = JSON.parse(m.content); } catch { parsedContent = null; }
        return { ...m, parsedContent };
      });
      const exams = parsed.filter((m) => (m.parsedContent && m.parsedContent.kind === 'examination') || (typeof m.content === 'string' && m.content.toLowerCase().includes('examination')));
      // sort newest first
      exams.sort((a, b) => new Date(b.created_at || b.timestamp).getTime() - new Date(a.created_at || a.timestamp).getTime());
      setExamSuggestions(exams);
    } catch (error) {
      console.warn('Failed to load exam suggestions', error);
      setExamSuggestions([]);
    } finally {
      setLoadingExams(false);
    }
  }, [user?.id]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.warn('Logout failed', error);
    }
  };

  const handleJoinCommunity = async (community) => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in first.');
      return;
    }
    if (joiningCommunities[community.id]) return;
    
    setJoiningCommunities((prev) => ({ ...prev, [community.id]: true }));
    try {
      await communityApi.join(community.id, {
        user_id: user.id,
        therapist_id: user?.therapist_id || null,
      });
      Alert.alert('Success', `Joined ${community.name}!`);
      // Refresh communities list
      loadCommunities();
    } catch (error) {
      console.warn('Failed to join community', error);
      const message = error?.response?.data?.error || 'Failed to join community. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setJoiningCommunities((prev) => ({ ...prev, [community.id]: false }));
    }
  };

  const handleLeaveCommunity = async (community) => {
    if (!user?.id) return;
    if (joiningCommunities[community.id]) return;
    
    setJoiningCommunities((prev) => ({ ...prev, [community.id]: true }));
    try {
      await communityApi.leave(community.id, user.id);
      Alert.alert('Success', `Left ${community.name}.`);
      // Refresh communities list
      loadCommunities();
    } catch (error) {
      console.warn('Failed to leave community', error);
      const message = error?.response?.data?.error || 'Failed to leave community. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setJoiningCommunities((prev) => ({ ...prev, [community.id]: false }));
    }
  };

  const handleToggleLike = async (post) => {
    if (!user?.id) return;
    const key = getPostKey(post);
    if (likeLoading[key]) return;
    setLikeLoading((prev) => ({ ...prev, [key]: true }));
    try {
      if (post.liked_by_user) {
        await therapistPostApi.unlike(post.id, { user_id: user.id });
        setTherapistFeed((prev) =>
          prev.map((item) =>
            item.postKey === key
              ? {
                  ...item,
                  liked_by_user: false,
                  likes_count: Math.max((item.likes_count ?? 0) - 1, 0),
                }
              : item
          )
        );
      } else {
        await therapistPostApi.like(post.id, { user_id: user.id });
        setTherapistFeed((prev) =>
          prev.map((item) =>
            item.postKey === key
              ? {
                  ...item,
                  liked_by_user: true,
                  likes_count: (item.likes_count ?? 0) + 1,
                }
              : item
          )
        );
      }
    } catch (error) {
      if (error?.response?.status === 409) {
        setTherapistFeed((prev) =>
          prev.map((item) =>
            item.postKey === key
              ? { ...item, liked_by_user: true, likes_count: Math.max(item.likes_count ?? 0, 0) }
              : item
          )
        );
      } else {
        console.error('[PatientLike] Failed to toggle like', error.response?.data || error.message);
      }
    } finally {
      setLikeLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleSubmitComment = async (post) => {
    const key = getPostKey(post);
    const draft = (commentDrafts[key] || '').trim();
    if (!draft || !user?.id) return;
    setCommentLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await therapistPostApi.createComment(post.id, {
        user_id: user.id,
        content: draft,
      });
      setTherapistFeed((prev) =>
        prev.map((item) =>
          item.postKey === key
            ? { ...item, comments_count: (item.comments_count ?? 0) + 1 }
            : item
        )
      );
      setCommentDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setCommentInputVisible((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    } catch (error) {
      console.error('[PatientComment] Failed to create comment', error.response?.data || error.message);
    } finally {
      setCommentLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const feedSubtitle = 'Latest updates from your therapist';

  if (selectedCommunity) {
    return (
      <CommunityDetail
        route={{ params: { community: selectedCommunity } }}
        navigation={{
          goBack: () => setSelectedCommunity(null),
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {activeTab === 'Tracking' ? (
        <TrackingScreen />
      ) : activeTab === 'Community' ? (
        <CommunityScreen onSelectCommunity={setSelectedCommunity} />
      ) : activeTab === 'Resources' ? (
        <ResourcesScreen />
      ) : activeTab === 'Telehealth' ? (
        <TelehealthScreen navigation={navigation} />
      ) : activeTab === 'Diagnosis' ? (
        <AssessmentsScreen />
      ) : activeTab === 'Messages' ? (
        <MessagesScreen />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.whitePanel}>
            <View style={styles.topRow}>
              <View style={styles.languageGroup}>
                {languages.map((lang) => (
                  <View key={lang} style={styles.languageBadge}>
                    <Text style={styles.languageText}>{lang}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.header}>
              <Text style={styles.brand}>MEDICARE</Text>
              <Text style={styles.greeting}>Hi Demo User, how are you feeling today</Text>
            </View>

            <View style={styles.feedIntro}>
              <Text style={styles.feedTitle}>Feed</Text>
              <Text style={styles.feedSubtitle}>{feedSubtitle}</Text>
            </View>

            <View style={styles.feedList}>
              {!loadingFeed && feedError ? (
                <Text style={styles.errorText}>{feedError}</Text>
              ) : null}
              {loadingFeed ? (
                <View style={styles.loadingFeedRow}>
                  <ActivityIndicator color="#0b61c6" />
                </View>
              ) : therapistFeed.length ? (
                therapistFeed.map((post) => {
                  const postKey = post.postKey || getPostKey(post);
                  const isCommentVisible = commentInputVisible[postKey];
                  const commentDraftValue = commentDrafts[postKey] ?? '';
                  const commentBusy = commentLoading[postKey];
                  const likeBusy = likeLoading[postKey];
                  const hasCommentText = commentDraftValue.trim();
                  return (
                    <View key={postKey} style={styles.card}>
                      <View style={styles.cardHeader}>
                        <View style={styles.avatarPlaceholder} />
                        <View style={styles.cardHeaderText}>
                          <Text style={styles.cardName}>{post.author_name || 'Therapist'}</Text>
                          <Text style={styles.cardRole}>{post.contextLabel || 'Therapist'}</Text>
                        </View>
                        <Text style={styles.cardDate}>{formatTimestamp(post.created_at || post.timestamp)}</Text>
                      </View>
                      <Text style={styles.cardMessage}>{post.content || post.message}</Text>
                      <View style={styles.cardFooter}>
                        <View style={styles.commentContainer}>
                          <Text style={styles.commentCount}>{post.comments_count ?? 0}</Text>
                          <Text style={styles.commentLabel}>Comments</Text>
                        </View>
                        <View style={styles.likesContainer}>
                          <Text style={styles.commentCount}>{post.likes_count ?? 0}</Text>
                          <Text style={styles.commentLabel}>Likes</Text>
                        </View>
                      </View>
                      <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                          style={[
                            styles.actionButton,
                            post.liked_by_user && styles.actionButtonActive,
                          ]}
                          onPress={() => handleToggleLike(post)}
                          disabled={likeBusy}
                        >
                          <Ionicons
                            name={post.liked_by_user ? 'heart' : 'heart-outline'}
                            size={16}
                            color={post.liked_by_user ? '#fff' : '#333'}
                          />
                          <Text
                            style={[
                              styles.actionLabel,
                              post.liked_by_user && styles.actionLabelActive,
                            ]}
                          >
                            Like
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() =>
                            setCommentInputVisible((prev) => ({
                              ...prev,
                              [postKey]: !prev[postKey],
                            }))
                          }
                        >
                          <Ionicons name="chatbubble-ellipses-outline" size={16} color="#333" />
                          <Text style={styles.actionLabel}>Comment</Text>
                        </TouchableOpacity>
                      </View>
                      {isCommentVisible ? (
                        <View style={styles.commentComposerRow}>
                          <TextInput
                            style={styles.commentInput}
                            placeholder="Write a comment"
                            placeholderTextColor="#aab0c2"
                            value={commentDraftValue}
                            onChangeText={(text) =>
                              setCommentDrafts((prev) => ({ ...prev, [postKey]: text }))
                            }
                            editable={!commentBusy}
                          />
                          <TouchableOpacity
                            style={[
                              styles.commentSendButton,
                              (!hasCommentText || commentBusy) && styles.commentSendButtonDisabled,
                            ]}
                            onPress={() => handleSubmitComment(post)}
                            disabled={!hasCommentText || commentBusy}
                          >
                            {commentBusy ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.commentSendButtonText}>Send</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <Text style={styles.infoText}>
                  {user?.id ? 'No therapist posts yet.' : 'Log in to see therapist posts.'}
                </Text>
              )}
            </View>

            <View style={styles.feedIntro}>
              <Text style={styles.feedTitle}>Lab Examinations</Text>
              <Text style={styles.feedSubtitle}>Examinations suggested by your therapist</Text>
            </View>

            <View style={styles.examsList}>
              {loadingExams ? (
                <View style={styles.loadingFeedRow}>
                  <ActivityIndicator color="#0b61c6" />
                </View>
              ) : examSuggestions.length ? (
                examSuggestions.map((exam) => (
                  <View key={`exam-${exam.id || exam.timestamp}`} style={styles.examCard}>
                    <View style={styles.examHeader}>
                      <Text style={styles.examTitle}>{exam.message?.split('\n')[0] || 'Examination Suggestion'}</Text>
                      <Text style={styles.examDate}>{new Date(exam.created_at || exam.timestamp).toLocaleString()}</Text>
                    </View>
                    <Text style={styles.examNotes}>{(exam.parsedContent && exam.parsedContent.examination) || exam.content}</Text>
                    {(exam.parsedContent && (exam.parsedContent.lab_name || exam.parsedContent.scheduled_at)) && (
                      <View style={{ marginTop: 8 }}>
                        {exam.parsedContent.lab_name ? <Text style={{ fontSize: 12, color: '#374151' }}>Lab: {exam.parsedContent.lab_name}</Text> : null}
                        {exam.parsedContent.scheduled_at ? <Text style={{ fontSize: 12, color: '#374151' }}>Scheduled: {new Date(exam.parsedContent.scheduled_at).toLocaleString()}</Text> : null}
                      </View>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.infoText}>{user?.id ? 'No examination suggestions.' : 'Log in to see examination suggestions.'}</Text>
              )}
            </View>

            <View style={styles.feedIntro}>
              <Text style={styles.feedTitle}>Communities</Text>
              <Text style={styles.feedSubtitle}>Join groups created by therapists</Text>
            </View>

            <View style={styles.communitiesList}>
              {!loadingCommunities && communitiesError ? (
                <Text style={styles.errorText}>{communitiesError}</Text>
              ) : null}
              {loadingCommunities ? (
                <View style={styles.loadingFeedRow}>
                  <ActivityIndicator color="#0b61c6" />
                </View>
              ) : communities.length ? (
                communities.map((community) => (
                  <View key={`community-${community.id}`} style={styles.communityCard}>
                    <View style={styles.communityHeader}>
                      <Ionicons name="people-circle" size={24} color="#6b4fd9" />
                      <View style={styles.communityInfo}>
                        <Text style={styles.communityName}>{community.name}</Text>
                        <Text style={styles.communityCreator}>by {community.creator_name || 'Therapist'}</Text>
                      </View>
                    </View>
                    {community.description ? (
                      <Text style={styles.communityDescription}>{community.description}</Text>
                    ) : null}
                    <Text style={styles.communityMembers}>{community.member_count || 0} members</Text>
                    <View style={styles.communityButtonRow}>
                      <TouchableOpacity
                        style={[
                          styles.joinButton,
                          community.is_member && styles.joinButtonActive,
                        ]}
                        onPress={() =>
                          community.is_member
                            ? handleLeaveCommunity(community)
                            : handleJoinCommunity(community)
                        }
                        disabled={joiningCommunities[community.id]}
                      >
                        {joiningCommunities[community.id] ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text
                            style={[
                              styles.joinButtonText,
                              community.is_member && styles.joinButtonTextActive,
                            ]}
                          >
                            {community.is_member ? 'Leave' : 'Join'}
                          </Text>
                        )}
                      </TouchableOpacity>
                      {community.is_member ? (
                        <TouchableOpacity
                          style={styles.exploreButton}
                          onPress={() => setSelectedCommunity(community)}
                        >
                          <Text style={styles.exploreButtonText}>Explore</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.infoText}>
                  {user?.id ? 'No communities available.' : 'Log in to see communities.'}
                </Text>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      <View style={styles.bottomNav}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.label;
          return (
            <TouchableOpacity key={item.label} style={styles.navItem} onPress={() => setActiveTab(item.label)}>
              <Ionicons name={item.icon} size={22} color={isActive ? '#0b61c6' : '#8c8c8c'} />
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scroll: {
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
  },
  whitePanel: {
    borderRadius: 30,
    backgroundColor: '#fff',
    padding: 20,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
    borderWidth: 1,
    borderColor: '#f5f1eb',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  languageGroup: {
    flexDirection: 'row',
  },
  languageBadge: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: '#fff',
  },
  languageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1b1b1b',
  },
  logoutButton: {
    backgroundColor: '#e02a3f',
    paddingVertical: 6,
    paddingHorizontal: 20,
    borderRadius: 22,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  header: {
    marginBottom: 16,
  },
  brand: {
    fontSize: 24,
    fontWeight: '700',
    color: '#191919',
  },
  greeting: {
    marginTop: 6,
    fontSize: 13,
    color: '#5f5f6b',
  },
  feedIntro: {
    marginBottom: 8,
  },
  feedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#191919',
  },
  feedSubtitle: {
    fontSize: 12,
    color: '#9b9b9f',
  },
  feedList: {
    marginTop: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f1f1f1',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#dcdcdc',
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#161616',
  },
  cardRole: {
    fontSize: 12,
    color: '#9c9c9c',
  },
  cardDate: {
    fontSize: 12,
    color: '#9c9c9c',
  },
  cardMessage: {
    fontSize: 14,
    color: '#2f2f33',
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  commentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#f1f1f1',
  },
  commentCount: {
    fontSize: 12,
    fontWeight: '700',
    marginRight: 6,
    color: '#4a4a4a',
  },
  commentLabel: {
    fontSize: 10,
    color: '#7a7a7a',
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#e8f0ff',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e3e6f0',
    backgroundColor: '#fff',
    marginRight: 10,
  },
  actionButtonActive: {
    backgroundColor: '#0b61c6',
    borderColor: '#0b61c6',
  },
  actionLabel: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  actionLabelActive: {
    color: '#fff',
  },
  commentComposerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e3e6f0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f9fafc',
  },
  commentInput: {
    flex: 1,
    minHeight: 36,
    paddingVertical: 6,
    color: '#161616',
  },
  commentSendButton: {
    backgroundColor: '#0b61c6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  commentSendButtonDisabled: {
    backgroundColor: '#a7bbde',
  },
  commentSendButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  infoText: {
    color: '#6b6d80',
    fontSize: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#e02a3f',
    fontSize: 12,
    marginBottom: 12,
  },
  loadingFeedRow: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderColor: '#d9d9d5',
    backgroundColor: '#fff',
  },
  navItem: {
    alignItems: 'center',
  },
  navLabel: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#0b61c6',
    fontWeight: '700',
  },
  communitiesList: {
    marginTop: 12,
  },
  communityCard: {
    borderWidth: 1,
    borderColor: '#e3e6f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#f9fafc',
  },
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  communityInfo: {
    flex: 1,
    marginLeft: 10,
  },
  communityName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#161616',
  },
  communityCreator: {
    fontSize: 12,
    color: '#6b6d80',
    marginTop: 2,
  },
  communityDescription: {
    fontSize: 12,
    color: '#4a4a4a',
    marginBottom: 8,
    lineHeight: 16,
  },
  communityMembers: {
    fontSize: 11,
    color: '#8c8c8c',
    marginBottom: 10,
  },
  communityButtonRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  joinButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0b61c6',
    alignItems: 'center',
  },
  joinButtonActive: {
    backgroundColor: '#e8f0ff',
    borderWidth: 1,
    borderColor: '#0b61c6',
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  joinButtonTextActive: {
    color: '#0b61c6',
  },
  exploreButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#6b4fd9',
    alignItems: 'center',
  },
  exploreButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
    examsList: {
      marginBottom: 12,
    },
    examCard: {
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 6,
      elevation: 2,
    },
    examHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    examTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
    examDate: { fontSize: 11, color: '#6b6d80' },
    examNotes: { fontSize: 13, color: '#374151' },
});