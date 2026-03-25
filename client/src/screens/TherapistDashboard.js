import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
// server-generated PDF will be used instead of client-side generation
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';

import AuthContext from '../context/AuthContext';
import apiClient, { therapistPostApi, therapistApi, notificationApi } from '../api';
import { useNavigation } from '@react-navigation/native';

const getPostTimestamp = (post) => {
  const value = post?.created_at ?? post?.timestamp;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const normalizeTherapistPost = (post) => ({
  ...post,
  contextLabel: post.author_name || 'Therapist',
  postKey: `therapist:${post.id}`,
});

const NOTIFICATIONS = [
  {
    id: 'notif-1',
    type: 'appointment',
    title: 'New Appointment',
    user: 'User #12',
    detail: 'Starts: 11/15/2025, 6:00 PM',
    timestamp: '11/15/2025, 3:41:54 PM',
    message: 'Message about appointment',
  },
  {
    id: 'notif-2',
    type: 'message',
    title: 'New Message',
    user: 'From user #12',
    detail: 'Good',
    timestamp: '11/15/2025, 3:12:45 PM',
    message: 'Reply to message',
  },
  {
    id: 'notif-3',
    type: 'appointment',
    title: 'New Appointment',
    user: 'User #34',
    detail: 'Starts: 1/11/2026, 3:50 PM',
    timestamp: '11/15/2025, 3:11:12 PM',
    message: 'Message about appointment',
  },
  {
    id: 'notif-4',
    type: 'message',
    title: 'New Message',
    user: 'From user #8',
    detail: 'Good',
    timestamp: '11/15/2025, 2:36:19 PM',
    message: 'Reply to message',
  },
];

export function NotificationFeed() {
  const { user } = React.useContext(AuthContext);
  const therapistId = user?.therapist_id || user?.id;
  const [notifications, setNotifications] = React.useState([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [labModalVisible, setLabModalVisible] = React.useState(false);
  const [labPayload, setLabPayload] = React.useState(null);
  const [exportingPdf, setExportingPdf] = React.useState(false);
  const [labResults, setLabResults] = React.useState([]);
  const navigation = useNavigation();

  // DEBUG: Log when component mounts
  React.useEffect(() => {
    console.log('NotificationFeed mounted, therapistId:', therapistId);
  }, [therapistId]);

  const loadNotifications = React.useCallback(async () => {
    if (!therapistId) return;
    setLoading(true);
    try {
      const resp = await notificationApi.getNotifications(therapistId);
      const data = resp.data || {};
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(data.unreadCount || 0);
    } catch (e) {
      console.warn('Failed to load notifications', e);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [therapistId]);

  React.useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleOpen = async (notif) => {
    let payload = notif.payload_json;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = {}; }
    }
    if (payload?.kind === 'assessment' && payload.assessment_id) {
      // open assessment results screen
      navigation.navigate('AssessmentResultsScreen', { assessmentId: payload.assessment_id });
      // mark all as read (server has mark-all endpoint)
      try { await notificationApi.markAsRead(therapistId); } catch (e) {}
      loadNotifications();
      return;
    }
    if (payload?.kind === 'appointment' && payload.appointment_id) {
      // navigate to appointment details screen
      try {
        navigation.navigate('AppointmentDetails', { appointmentId: payload.appointment_id });
        await notificationApi.markAsRead(therapistId);
        loadNotifications();
      } catch (e) {
        console.warn('Failed to open appointment details', e);
        // fallback: show alert with meeting link
        const startDate = payload.starts_at ? new Date(payload.starts_at).toLocaleString() : '';
        const meetingLinkText = payload.meeting_link ? `\n\nMeeting Link:\n${payload.meeting_link}` : '';
        Alert.alert('Appointment Request', `Patient: ${payload.patient_name || 'Unknown'}\nEmail: ${payload.patient_email || 'N/A'}\nScheduled: ${startDate}\nCall Type: ${payload.call_type || 'N/A'}${meetingLinkText}`);
      }
      return;
    }
    if (payload?.kind === 'lab_result' && payload.assignment_id) {
      // open modal for lab result details
      console.log('🎯 OPENING LAB RESULT MODAL:', payload.assignment_id);
      setLabPayload(payload);
      setLabModalVisible(true);
      // fetch any uploaded lab results for this assignment (therapist endpoint)
      try {
        if (therapistId) {
          const resp = await apiClient.get(`/api/therapists/${therapistId}/lab-results/${payload.assignment_id}`);
          setLabResults(Array.isArray(resp.data) ? resp.data : []);
        } else {
          setLabResults([]);
        }
      } catch (e) {
        console.warn('Failed to fetch lab results', e);
        setLabResults([]);
      }
      return;
    }
    // Open chat when notification is a message
    if (payload?.kind === 'message' || notif.type === 'message') {
      // try common places for the user id
      let userIdToOpen = payload?.user_id || payload?.userId || notif.user_id || notif.userId || payload?.userId;
      // if message_id is present but user id missing, fetch messages for the user from server
      if (!userIdToOpen && payload?.message_id) {
        try {
          const resp = await messageApi.getForUser(payload.user_id || payload.userId || notif.user_id);
          const msgs = Array.isArray(resp.data) ? resp.data : [];
          const found = msgs.find(m => String(m.id) === String(payload.message_id));
          if (found) userIdToOpen = found.user_id || found.userId || payload.user_id;
        } catch (e) {
          // ignore fetch errors
        }
      }
      if (userIdToOpen) {
        try {
          // ChatThread is inside the Messages tab stack — navigate to Messages then to ChatThread
          navigation.navigate('Messages', { screen: 'ChatThread', params: { therapistId, userId: userIdToOpen } });
          await notificationApi.markAsRead(therapistId);
          loadNotifications();
          return;
        } catch (e) {
          console.warn('Failed to open chat thread', e);
        }
      }
    }
    // fallback: just refresh
    loadNotifications();
  };

  const closeLabModal = async () => {
    setLabModalVisible(false);
    try { await notificationApi.markAsRead(therapistId); } catch (e) {}
    loadNotifications();
    setLabPayload(null);
    setLabResults([]);
  };

  const handleExportPdf = async () => {
    if (!labPayload || !labPayload.assignment_id) return Alert.alert('No data', 'No lab payload available to export');
    const url = `${apiClient.defaults.baseURL}/api/labs/assignments/${labPayload.assignment_id}/report`;
    try {
      setExportingPdf(true);
      // If running in web, open in new tab to view/download
      if (typeof window !== 'undefined' && window.open) {
        window.open(url, '_blank');
        return;
      }
      // Native: fetch PDF and share
      const resp = await axios.get(url, { responseType: 'arraybuffer' });
      const base64 = Buffer.from(resp.data).toString('base64');
      const filename = `${FileSystem.documentDirectory}lab-result-${labPayload.assignment_id || 'report'}.pdf`;
      await FileSystem.writeAsStringAsync(filename, base64, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(filename, { mimeType: 'application/pdf' });
    } catch (e) {
      console.error('Failed to download PDF', e);
      Alert.alert('Error', 'Failed to download PDF report');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <>
    <View style={styles.notificationsSection}>
      <View style={styles.notificationsHeader}>
        <Text style={styles.notificationsLabel}>Notifications</Text>
        <TouchableOpacity style={styles.markAllButton} onPress={async () => { Alert.alert('Mark All', 'Clicked'); await notificationApi.markAsRead(therapistId); loadNotifications(); }}>
          <Text style={styles.markAllText}>Mark all read</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <Text style={styles.infoText}>Loading notifications…</Text>
      ) : notifications.length === 0 ? (
        <Text style={styles.emptyText}>No notifications</Text>
      ) : (
        notifications.map((notification) => {
          const payloadRaw = notification.payload_json;
          let payload = payloadRaw;
          if (typeof payloadRaw === 'string') {
            try { payload = JSON.parse(payloadRaw); } catch { payload = {}; }
          }
          const isAssessment = notification.type === 'assessment' || payload?.kind === 'assessment';
          const isAppointment = notification.type === 'appointment' || payload?.kind === 'appointment';
          const isLabResult = notification.type === 'lab_result' || payload?.kind === 'lab_result';
          const iconName = isAssessment ? 'clipboard' : (isAppointment ? 'calendar' : (isLabResult ? 'flask' : 'chatbubble-ellipses'));
          const iconColor = isAssessment ? '#6b4fd9' : (isAppointment ? '#f9a826' : (isLabResult ? '#FF6B6B' : '#3b82f6'));

          const title = isAssessment ? (payload.template_title ? `Diagnosis: ${payload.template_title}` : 'Diagnosis submitted') : (isAppointment ? 'New Appointment Request' : (isLabResult ? 'Lab Test Results' : 'New Message'));
          const userLabel = isAssessment ? (payload.patient_name || `User ${payload.user_id || ''}`) : (isAppointment ? (payload.patient_name || `User ${payload.user_id || ''}`) : (isLabResult ? `Assignment #${payload.assignment_id || 'N/A'}` : (notification.user || '')));
          const startDate = isAppointment && payload.starts_at ? new Date(payload.starts_at).toLocaleString() : '';
          const detail = isAssessment ? `Score: ${payload.total_percent ?? ''}%` : (isAppointment ? `Scheduled: ${startDate}` : (isLabResult ? `Results available for lab assignment` : notification.detail));

          return (
            <View key={notification.id} style={styles.notificationCard}>
              <View style={styles.notificationHeaderRow}>
                <View style={styles.notificationIconLabel}>
                  <View style={styles.notificationIconCircle}>
                    <Ionicons name={iconName} size={22} color={iconColor} />
                  </View>
                  <View style={styles.notificationTitleGroup}>
                    <Text style={styles.notificationTitle}>{title}</Text>
                    <Text style={styles.notificationUser}>{userLabel}</Text>
                  </View>
                </View>
                <View style={styles.notificationHeaderRight}>
                  <Pressable 
                    style={styles.openButton} 
                    onPress={() => {
                      console.log('PRESSED OPEN BUTTON');
                      handleOpen(notification);
                    }}>
                    <Text style={styles.openText}>Open</Text>
                  </Pressable>
                  {notification.is_read === 0 && (
                    <View style={styles.newBadge}><Text style={styles.newText}>NEW</Text></View>
                  )}
                </View>
              </View>
              <Text style={styles.notificationDetail}>{detail}</Text>
              <Text style={styles.notificationTimestamp}>{notification.created_at}</Text>
              <View style={styles.notificationFooter}>
                <Text style={styles.notificationMessage}>{payload?.message || notification.message || ''}</Text>
              </View>
            </View>
          );
        })
      )}
    </View>

    <Modal visible={labModalVisible} animationType="slide" transparent onRequestClose={closeLabModal}>
      <Pressable style={styles.modalOverlay} onPress={closeLabModal}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHandleWrap}>
            <View style={styles.modalHandle} />
          </View>
          <View style={styles.modalHeader}>
            <View style={{flexDirection:'row', alignItems:'center', flex:1}}>
                <View style={styles.modalIconCircle}><Ionicons name="flask" size={18} color="#ff6b6b" /></View>
                <Text style={[styles.modalTitle, {flexShrink:1, marginRight:8}]} numberOfLines={1}>Lab Test Results</Text>
                <Text style={styles.modalSubtitle}>Assignment #{labPayload?.assignment_id}</Text>
              </View>
            <View style={{flexDirection:'row', alignItems:'center'}}>
              <Pressable onPress={handleExportPdf} style={[styles.modalExportButtonSmall, exportingPdf && {opacity:0.7}]}> 
                {exportingPdf ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{flexDirection:'row', alignItems:'center', gap:6}}>
                    <Ionicons name="download" size={14} color="#fff" />
                    <Text style={styles.modalExportTextSmall}>PDF</Text>
                  </View>
                )}
              </Pressable>
              <Pressable onPress={closeLabModal} style={styles.modalCloseIcon}> 
                <Ionicons name="close" size={16} color="#fff" />
              </Pressable>
            </View>
          </View>
          <ScrollView style={styles.modalContent} contentContainerStyle={{paddingBottom:28}}>
            <Text style={styles.modalFieldLabel}>Received</Text>
            <Text style={styles.modalFieldValue}>{labPayload?.received_at ?? labPayload?.created_at ?? labPayload?.createdAt ?? ''}</Text>

            <Text style={styles.modalFieldLabel}>Notes</Text>
            <Text style={styles.modalFieldValue}>{labPayload?.message ?? labPayload?.notes ?? 'No additional notes'}</Text>

            <Text style={[styles.modalFieldLabel, {marginTop:12}]}>Details</Text>
            <View style={styles.detailBlock}>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Assignment ID</Text><Text style={styles.detailValue}>{labPayload?.assignment_id ?? (labPayload?.assignment?.id ?? '')}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Status</Text><Text style={styles.detailValue}>{labPayload?.assignment?.status ?? labPayload?.status ?? ''}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Lab ID</Text><Text style={styles.detailValue}>{labPayload?.assignment?.lab_id ?? labPayload?.lab_id ?? ''}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Message ID</Text><Text style={styles.detailValue}>{labPayload?.assignment?.message_id ?? labPayload?.message_id ?? ''}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Therapist</Text><Text style={styles.detailValue}>{labPayload?.assignment?.therapist_id ?? labPayload?.therapist_id ?? ''}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Patient</Text><Text style={styles.detailValue}>{labPayload?.assignment?.user_name ?? labPayload?.assignment?.user_id ?? labPayload?.user_id ?? ''}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Assigned</Text><Text style={styles.detailValue}>{labPayload?.assignment?.assigned_at ?? labPayload?.assigned_at ?? ''}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Accepted</Text><Text style={styles.detailValue}>{labPayload?.assignment?.accepted_at ?? labPayload?.accepted_at ?? ''}</Text></View>
              <View style={styles.detailRow}><Text style={styles.detailLabel}>Completed</Text><Text style={styles.detailValue}>{labPayload?.assignment?.completed_at ?? labPayload?.completed_at ?? ''}</Text></View>
            </View>
            {labResults && labResults.length > 0 && (
              <>
                <Text style={[styles.modalFieldLabel, {marginTop:12}]}>Results</Text>
                <View style={[styles.detailBlock, {padding:12}]}> 
                  {labResults.map((r) => {
                    let parsed = r.result_json;
                    try { parsed = typeof r.result_json === 'string' ? JSON.parse(r.result_json) : r.result_json; } catch(e) { /* keep raw */ }
                    const text = typeof parsed === 'string' ? parsed : (typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : String(parsed));
                    return (
                      <View key={r.id} style={{marginBottom:10}}>
                        <Text style={{fontSize:12, color:'#6b6d80'}}>Uploaded: {r.uploaded_at || r.created_at || ''} • By: {r.uploaded_by || ''}</Text>
                        <Text style={{fontSize:13, color:'#111', marginTop:6}}>{text}</Text>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

export default function TherapistDashboard({ route }) {
  const { user } = useContext(AuthContext);
  const therapistId = user?.therapist_id || user?.id || route?.params?.therapistId;
  const [data, setData] = useState(null);
  const [therapistFeed, setTherapistFeed] = useState([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [feedError, setFeedError] = useState('');
  const [postContent, setPostContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentLoading, setCommentLoading] = useState({});
  const [likeLoading, setLikeLoading] = useState({});

  useEffect(() => {
    if (!therapistId) return;
    therapistApi
      .getDashboard(therapistId)
      .then((resp) => setData(resp.data))
      .catch((e) => console.warn('Failed to load dashboard', e));
  }, [therapistId]);


  const loadTherapistFeed = useCallback(async () => {
    if (!therapistId) {
      setTherapistFeed([]);
      setFeedError('');
      return;
    }
    setLoadingFeed(true);
    setFeedError('');
    try {
      const resp = await therapistPostApi.getAll({
        therapist_id: therapistId,
        viewer_therapist_id: therapistId,
      });
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
  }, [therapistId]);

  useEffect(() => {
    loadTherapistFeed();
  }, [loadTherapistFeed]);

  const handlePost = async () => {
    if (!therapistId || !postContent.trim() || posting) return;
    setPosting(true);
    try {
      const payload = {
        therapist_id: therapistId,
        content: postContent.trim(),
      };
      console.log('[TherapistPost] Sending payload:', payload);
      const resp = await therapistPostApi.create(payload);
      console.log('[TherapistPost] Success:', resp.data);
      setTherapistFeed((prev) => [normalizeTherapistPost(resp.data), ...prev]);
      setPostContent('');
      Alert.alert('Success', 'Post created successfully!');
    } catch (error) {
      console.error('[TherapistPost] Failed to create post', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.error || error.message || 'Failed to create post');
    } finally {
      setPosting(false);
    }
  };

  const handleToggleLike = async (post) => {
    if (!therapistId) return;
    if (likeLoading[post.id]) return;
    setLikeLoading((prev) => ({ ...prev, [post.id]: true }));
    try {
      if (post.liked_by_therapist) {
        await therapistPostApi.unlike(post.id, { therapist_id: therapistId });
        setTherapistFeed((prev) =>
          prev.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  liked_by_therapist: false,
                  likes_count: Math.max((item.likes_count ?? 0) - 1, 0),
                }
              : item
          )
        );
      } else {
        await therapistPostApi.like(post.id, { therapist_id: therapistId });
        setTherapistFeed((prev) =>
          prev.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  liked_by_therapist: true,
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
            item.id === post.id
              ? { ...item, liked_by_therapist: true, likes_count: Math.max(item.likes_count ?? 0, 0) }
              : item
          )
        );
      } else {
        console.error('[TherapistLike] Failed to toggle like', error.response?.data || error.message);
        Alert.alert('Error', error.response?.data?.error || error.message || 'Failed to update like');
      }
    } finally {
      setLikeLoading((prev) => ({ ...prev, [post.id]: false }));
    }
  };

  const handleSubmitComment = async (postId) => {
    const draft = (commentDrafts[postId] || '').trim();
    if (!draft || !therapistId) return;
    setCommentLoading((prev) => ({ ...prev, [postId]: true }));
    try {
      await therapistPostApi.createComment(postId, {
        therapist_id: therapistId,
        content: draft,
      });
      setTherapistFeed((prev) =>
        prev.map((item) =>
          item.id === postId
            ? { ...item, comments_count: (item.comments_count ?? 0) + 1 }
            : item
        )
      );
      setCommentDrafts((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
    } catch (error) {
      console.error('[TherapistComment] Failed to create comment', error.response?.data || error.message);
      Alert.alert('Error', error.response?.data?.error || error.message || 'Failed to create comment');
    } finally {
      setCommentLoading((prev) => ({ ...prev, [postId]: false }));
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.pageLabel}>Dashboard</Text>
        <View style={styles.langRow}>
          <View style={styles.langPill}>
            <Text style={styles.langText}>EN</Text>
          </View>
          <View style={styles.langPill}>
            <Text style={styles.langText}>RW</Text>
          </View>
          <View style={styles.langPill}>
            <Text style={styles.langText}>FR</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroCard}>
          <Text style={styles.heroTitle}>Therapist Dashboard</Text>
          <Text style={styles.heroSubtitle}>
            {data
              ? `Today: ${data.meta?.todayCount || 0} • Caseload: ${data.meta?.caseloadCount || 0}`
              : 'Loading...'}
          </Text>
          <View style={styles.heroChips}>
            <View style={styles.heroChip}>
              <Text style={styles.heroChipLabel}>Unread messages</Text>
              <Text style={styles.heroChipValue}>7</Text>
            </View>
            <View style={[styles.heroChip, styles.heroChipLast]}>
              <Text style={styles.heroChipLabel}>Active groups</Text>
              <Text style={styles.heroChipValue}>3</Text>
            </View>
          </View>
        </View>

        <View style={styles.postComposer}>
          <Text style={styles.composerTitle}>Therapist post box</Text>
          <Text style={styles.composerSubtitle}>Share an update with your clients.</Text>
          <TextInput
            style={styles.composerInput}
            multiline
            placeholder="Write a short update for your clients"
            placeholderTextColor="#aab0c2"
            value={postContent}
            onChangeText={setPostContent}
            editable={!posting}
          />
          <TouchableOpacity
            style={styles.postButton}
            onPress={handlePost}
            disabled={!therapistId || !postContent.trim() || posting}
          >
            <Text style={styles.postButtonText}>{posting ? 'Posting…' : 'Post'}</Text>
          </TouchableOpacity>
        </View>

        <NotificationFeed />

        <View style={styles.postsSection}>
          <View style={styles.postsHeader}>
            <Text style={styles.sectionTitle}>Your Therapist Posts</Text>
          </View>
          {feedError ? <Text style={styles.errorText}>{feedError}</Text> : null}
          {loadingFeed ? (
            <Text style={styles.infoText}>Loading posts…</Text>
          ) : therapistFeed.length ? (
            therapistFeed.map((post) => {
              const likeCount = post.likes_count ?? post.likes ?? 0;
              const commentCount = post.comments_count ?? 0;
              const likedByTherapist = !!post.liked_by_therapist;
              return (
                <View key={post.id || post.created_at} style={styles.postCard}>
                  <View style={styles.postHeader}>
                    <View style={styles.avatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.postAuthor}>{post.author_name || 'Therapist'}</Text>
                      <Text style={styles.communityLabel}>{post.contextLabel || 'Therapist'}</Text>
                    </View>
                  </View>
                  <Text style={styles.postText}>{post.content || post.text}</Text>
                  <View style={styles.postFooter}>
                    <View style={styles.actionsRow}>
                      <TouchableOpacity
                        style={[styles.actionPill, likedByTherapist && styles.activeActionPill]}
                        onPress={() => handleToggleLike(post)}
                        disabled={!therapistId || likeLoading[post.id]}
                      >
                        {likeLoading[post.id] ? (
                          <ActivityIndicator
                            size="small"
                            color={likedByTherapist ? '#fff' : '#0b61c6'}
                          />
                        ) : (
                          <Text style={[styles.actionText, likedByTherapist && styles.activeActionText]}>
                            ❤️ {likeCount}
                          </Text>
                        )}
                      </TouchableOpacity>
                      <View style={styles.actionPill}>
                        <Text style={styles.actionText}>💬 {commentCount}</Text>
                      </View>
                    </View>
                    <Text style={styles.timestamp}>{post.created_at || post.timestamp}</Text>
                  </View>
                  <View style={styles.commentComposer}>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Add a comment"
                      placeholderTextColor="#aab0c2"
                      value={commentDrafts[post.id] ?? ''}
                      onChangeText={(text) =>
                        setCommentDrafts((prev) => ({ ...prev, [post.id]: text }))
                      }
                      editable={!commentLoading[post.id]}
                    />
                    <TouchableOpacity
                      style={[
                        styles.commentButton,
                        (!therapistId || !commentDrafts[post.id]?.trim() || commentLoading[post.id]) &&
                          styles.commentButtonDisabled,
                      ]}
                      onPress={() => handleSubmitComment(post.id)}
                      disabled={!therapistId || !commentDrafts[post.id]?.trim() || commentLoading[post.id]}
                    >
                      {commentLoading[post.id] ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.commentButtonText}>Send</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.infoText}>No therapist posts yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAFA' },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  pageLabel: { fontSize: 16, color: '#333' },
  langRow: { flexDirection: 'row', gap: 8 },
  langPill: {
    backgroundColor: '#222',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  langText: { color: '#fff', fontSize: 12 },
  content: { paddingHorizontal: 14, paddingBottom: 40 },
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 5,
  },
  heroTitle: { fontSize: 20, fontWeight: '700', color: '#181823' },
  heroSubtitle: { fontSize: 14, color: '#5b5b73', marginTop: 4 },
  heroChips: { flexDirection: 'row', marginTop: 14 },
  heroChip: {
    flex: 1,
    backgroundColor: '#eef1ff',
    borderRadius: 16,
    padding: 10,
    marginRight: 12,
  },
  heroChipLast: { marginRight: 0 },
  heroChipLabel: {
    fontSize: 10,
    color: '#6d6c87',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroChipValue: { fontSize: 18, fontWeight: '700', color: '#151533', marginTop: 4 },
  postComposer: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  composerTitle: { fontSize: 16, fontWeight: '700', color: '#161823' },
  composerSubtitle: { fontSize: 12, color: '#6a6d8c', marginBottom: 12 },
  composerInput: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#e3e6f0',
    borderRadius: 16,
    padding: 12,
    textAlignVertical: 'top',
    backgroundColor: '#f9fafc',
    color: '#1b1c2b',
  },
  postButton: {
    marginTop: 12,
    backgroundColor: '#0b61c6',
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: 'center',
  },
  postButtonText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  postsSection: { marginTop: 16 },
  postsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  communityLabel: { fontSize: 12, color: '#6a6d8c' },
  infoText: { color: '#6b6d80', fontSize: 12, marginBottom: 12 },
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DDD', marginRight: 8 },
  postAuthor: { fontWeight: '700', color: '#333' },
  postText: { color: '#222', marginBottom: 12 },
  postFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  actionsRow: { flexDirection: 'row' },
  actionPill: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  actionText: { color: '#333', fontSize: 13 },
  activeActionPill: { backgroundColor: '#0b61c6', borderColor: '#0b61c6' },
  activeActionText: { color: '#fff' },
  timestamp: { color: '#999', fontSize: 12 },
  commentComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e3e6f0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    fontSize: 13,
    color: '#1b1c2b',
    marginRight: 8,
  },
  commentButton: {
    backgroundColor: '#0b61c6',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  commentButtonDisabled: { opacity: 0.6 },
  commentButtonText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  notificationsSection: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  notificationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationsLabel: { fontSize: 18, fontWeight: '700' },
  markAllButton: {
    backgroundColor: '#222',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  markAllText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  notificationCard: {
    backgroundColor: '#fefefe',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e6e8f3',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  notificationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  notificationIconLabel: { flexDirection: 'row', alignItems: 'center' },
  notificationIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 16,
    backgroundColor: '#f3f5ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  notificationTitleGroup: { justifyContent: 'center' },
  notificationTitle: { fontSize: 14, fontWeight: '700', color: '#161732' },
  notificationUser: { fontSize: 12, color: '#6a6d8c' },
  notificationHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  openButton: {
    backgroundColor: '#0b61c6',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  openText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  newBadge: { backgroundColor: '#eef2ff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  newText: { fontSize: 10, fontWeight: '700', color: '#0b61c6' },
  notificationDetail: { fontSize: 12, color: '#4a4b66' },
  notificationTimestamp: { fontSize: 12, color: '#9c9fbf', marginBottom: 10 },
  notificationFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notificationMessage: { fontSize: 12, color: '#1b1b28', flex: 1 },
  sendButton: {
    backgroundColor: '#000',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginLeft: 12,
  },
  sendText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eef1f7',
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#151533' },
  modalSubtitle: { fontSize: 12, color: '#6b6d80', marginLeft: 8 },
  modalCloseButton: { marginLeft: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#0b61c6', borderRadius: 12 },
  modalCloseText: { color: '#fff', fontWeight: '700' },
  modalContent: { padding: 14, backgroundColor: '#fff' },
  modalFieldLabel: { fontSize: 12, color: '#6b6d80', marginTop: 8 },
  modalFieldValue: { fontSize: 13, color: '#111', marginTop: 4 },
  modalHandleWrap: { alignItems: 'center', paddingTop: 10 },
  modalHandle: { width: 40, height: 4, backgroundColor: '#e6e8f3', borderRadius: 4 },
  modalIconCircle: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff0f0', alignItems: 'center', justifyContent: 'center' },
  payloadBlock: { backgroundColor: '#f6f7fb', padding: 12, borderRadius: 10, marginTop: 8 },
  payloadText: { fontSize: 12, color: '#1b1b28', fontFamily: 'monospace' },
  modalExportButton: { backgroundColor: '#0b61c6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginRight: 8 },
  modalExportText: { color: '#fff', fontWeight: '700' },
  modalExportButtonSmall: { backgroundColor: '#0b61c6', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10, marginRight: 8, minWidth:40, alignItems:'center', justifyContent:'center' },
  modalExportTextSmall: { color: '#fff', fontWeight: '700', fontSize:12 },
  detailBlock: { marginTop: 8, backgroundColor: '#fff', padding: 8, borderRadius: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f1f2f6' },
  detailLabel: { color: '#6b6d80', fontSize: 12 },
  detailValue: { color: '#111', fontSize: 13, fontWeight: '600' },
  modalCloseIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#0b61c6', alignItems: 'center', justifyContent: 'center', marginRight: 8, borderWidth:0 },
});