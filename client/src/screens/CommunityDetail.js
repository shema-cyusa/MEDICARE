import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthContext from '../context/AuthContext';
import { communityApi } from '../api';

export default function CommunityDetail({ route, navigation }) {
  const { community } = route.params || {};
  const { user } = useContext(AuthContext);
  
  const [communityDetails, setCommunityDetails] = useState(community);
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [creatingPost, setCreatingPost] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentInputVisible, setCommentInputVisible] = useState({});
  const [commentLoading, setCommentLoading] = useState({});
  const [postLiking, setPostLiking] = useState({});

  const loadPosts = useCallback(async () => {
    if (!community?.id) return;
    setLoadingPosts(true);
    try {
      const resp = await communityApi.getPosts(community.id, { user_id: user?.id });
      const data = Array.isArray(resp.data) ? resp.data : [];
      setPosts(data);
    } catch (error) {
      console.warn('Failed to load community posts', error);
      Alert.alert('Error', 'Failed to load posts.');
    } finally {
      setLoadingPosts(false);
    }
  }, [community?.id, user?.id]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleCreatePost = async () => {
    if (!postContent.trim()) {
      Alert.alert('Validation', 'Please enter some content.');
      return;
    }
    if (!user?.id || !community?.id) {
      Alert.alert('Error', 'Unable to create post.');
      return;
    }

    setCreatingPost(true);
    try {
      await communityApi.createPost(community.id, {
        user_id: user.id,
        therapist_id: user?.therapist_id || null,
        content: postContent.trim(),
      });
      Alert.alert('Success', 'Post created!');
      setPostContent('');
      loadPosts();
    } catch (error) {
      console.warn('Failed to create post', error);
      const message = error?.response?.data?.error || 'Failed to create post.';
      Alert.alert('Error', message);
    } finally {
      setCreatingPost(false);
    }
  };

  const handleToggleLike = async (post) => {
    if (!user?.id) return;
    if (postLiking[post.id]) return;

    setPostLiking((prev) => ({ ...prev, [post.id]: true }));
    try {
      if (post.liked_by_user) {
        // Unlike - not implemented in API yet, but we'll prepare for it
        setPosts((prev) =>
          prev.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  liked_by_user: false,
                  likes_count: Math.max((item.likes_count ?? 0) - 1, 0),
                }
              : item
          )
        );
      } else {
        // Like
        setPosts((prev) =>
          prev.map((item) =>
            item.id === post.id
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
      console.warn('Failed to toggle like', error);
    } finally {
      setPostLiking((prev) => ({ ...prev, [post.id]: false }));
    }
  };

  const handleSubmitComment = async (post) => {
    const draft = (commentDrafts[post.id] || '').trim();
    if (!draft || !user?.id) return;

    setCommentLoading((prev) => ({ ...prev, [post.id]: true }));
    try {
      await communityApi.createComment(community.id, {
        user_id: user.id,
        post_id: post.id,
        content: draft,
      });
      setCommentDrafts((prev) => {
        const next = { ...prev };
        delete next[post.id];
        return next;
      });
      setCommentInputVisible((prev) => {
        const next = { ...prev };
        delete next[post.id];
        return next;
      });
      loadPosts();
    } catch (error) {
      console.warn('Failed to create comment', error);
      Alert.alert('Error', 'Failed to post comment.');
    } finally {
      setCommentLoading((prev) => ({ ...prev, [post.id]: false }));
    }
  };

  if (!community) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Community not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation?.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#0b61c6" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.communityName}>{community.name}</Text>
            <Text style={styles.memberCount}>{community.member_count || 0} members</Text>
          </View>
        </View>

        {community.description ? (
          <View style={styles.descriptionBox}>
            <Text style={styles.description}>{community.description}</Text>
          </View>
        ) : null}

        <View style={styles.creatorInfo}>
          <Ionicons name="person-circle" size={32} color="#6b4fd9" />
          <View style={styles.creatorDetails}>
            <Text style={styles.creatorLabel}>Created by</Text>
            <Text style={styles.creatorName}>{community.creator_name || 'Therapist'}</Text>
          </View>
        </View>

        <View style={styles.postComposer}>
          <Text style={styles.composerLabel}>Share your thoughts</Text>
          <TextInput
            style={styles.composerInput}
            placeholder="Write something..."
            placeholderTextColor="#aab0c2"
            value={postContent}
            onChangeText={setPostContent}
            multiline
            numberOfLines={4}
            editable={!creatingPost}
          />
          <TouchableOpacity
            style={[
              styles.postButton,
              (!postContent.trim() || creatingPost) && styles.postButtonDisabled,
            ]}
            onPress={handleCreatePost}
            disabled={!postContent.trim() || creatingPost}
          >
            {creatingPost ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.postsSection}>
          <Text style={styles.postsTitle}>Posts</Text>
          {loadingPosts ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#0b61c6" />
            </View>
          ) : posts.length ? (
            posts.map((post) => (
              <View key={`post-${post.id}`} style={styles.postCard}>
                <View style={styles.postHeader}>
                  <View style={styles.avatarPlaceholder} />
                  <View style={styles.postHeaderText}>
                    <Text style={styles.postAuthor}>{post.author_name || 'Member'}</Text>
                    <Text style={styles.postDate}>
                      {new Date(post.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.postContent}>{post.content}</Text>

                <View style={styles.postFooter}>
                  <View style={styles.statContainer}>
                    <Text style={styles.statCount}>{post.comments_count ?? 0}</Text>
                    <Text style={styles.statLabel}>Comments</Text>
                  </View>
                  <View style={styles.statContainer}>
                    <Text style={styles.statCount}>{post.likes_count ?? 0}</Text>
                    <Text style={styles.statLabel}>Likes</Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      post.liked_by_user && styles.actionButtonActive,
                    ]}
                    onPress={() => handleToggleLike(post)}
                    disabled={postLiking[post.id]}
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
                        [post.id]: !prev[post.id],
                      }))
                    }
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color="#333" />
                    <Text style={styles.actionLabel}>Comment</Text>
                  </TouchableOpacity>
                </View>

                {commentInputVisible[post.id] ? (
                  <View style={styles.commentComposer}>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Write a comment..."
                      placeholderTextColor="#aab0c2"
                      value={commentDrafts[post.id] || ''}
                      onChangeText={(text) =>
                        setCommentDrafts((prev) => ({ ...prev, [post.id]: text }))
                      }
                      editable={!commentLoading[post.id]}
                      multiline
                      numberOfLines={3}
                    />
                    <TouchableOpacity
                      style={[
                        styles.commentSendButton,
                        (!(commentDrafts[post.id] || '').trim() || commentLoading[post.id]) &&
                          styles.commentSendButtonDisabled,
                      ]}
                      onPress={() => handleSubmitComment(post)}
                      disabled={
                        !(commentDrafts[post.id] || '').trim() || commentLoading[post.id]
                      }
                    >
                      {commentLoading[post.id] ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.commentSendButtonText}>Post</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>No posts yet. Be the first to share!</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scroll: {
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#e3e6f0',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  communityName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#161616',
  },
  memberCount: {
    fontSize: 12,
    color: '#6b6d80',
    marginTop: 2,
  },
  descriptionBox: {
    margin: 16,
    padding: 12,
    backgroundColor: '#f9fafc',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#0b61c6',
  },
  description: {
    fontSize: 13,
    color: '#4a4a4a',
    lineHeight: 18,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f5f1eb',
    borderRadius: 12,
  },
  creatorDetails: {
    marginLeft: 12,
  },
  creatorLabel: {
    fontSize: 11,
    color: '#8c8c8c',
  },
  creatorName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4d3728',
  },
  postComposer: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#f9fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3e6f0',
  },
  composerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#161616',
    marginBottom: 8,
  },
  composerInput: {
    borderWidth: 1,
    borderColor: '#e3e6f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 80,
    backgroundColor: '#fff',
    fontSize: 13,
    color: '#161616',
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  postButton: {
    backgroundColor: '#0b61c6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  postButtonDisabled: {
    backgroundColor: '#a7bbde',
  },
  postButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  postsSection: {
    paddingHorizontal: 16,
  },
  postsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#161616',
    marginBottom: 12,
  },
  loadingRow: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  postCard: {
    borderWidth: 1,
    borderColor: '#e3e6f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e3e6f0',
  },
  postHeaderText: {
    marginLeft: 10,
    flex: 1,
  },
  postAuthor: {
    fontSize: 13,
    fontWeight: '600',
    color: '#161616',
  },
  postDate: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 2,
  },
  postContent: {
    fontSize: 13,
    color: '#4a4a4a',
    lineHeight: 18,
    marginBottom: 10,
  },
  postFooter: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e3e6f0',
    borderBottomWidth: 1,
    borderBottomColor: '#e3e6f0',
    marginBottom: 10,
  },
  statContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statCount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0b61c6',
    marginRight: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#8c8c8c',
  },
  actionRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e3e6f0',
    backgroundColor: '#fff',
    marginRight: 8,
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
  commentComposer: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e3e6f0',
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#e3e6f0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minHeight: 60,
    backgroundColor: '#f9fafc',
    fontSize: 12,
    color: '#161616',
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  commentSendButton: {
    backgroundColor: '#0b61c6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  commentSendButtonDisabled: {
    backgroundColor: '#a7bbde',
  },
  commentSendButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 13,
    color: '#8c8c8c',
    textAlign: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 15,
    color: '#e02a3f',
  },
});
