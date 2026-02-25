import axios from 'axios';

// For web/localhost, use 127.0.0.1 explicitly; for native use localhost
const isWeb = typeof window !== 'undefined';
const API_BASE_URL = process.env.REACT_APP_API_URL || (isWeb ? 'http://127.0.0.1:4000' : 'http://localhost:4000');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Auth endpoints
export const authApi = {
  signup: (data) => apiClient.post('/api/auth/signup', data),
  login: (data) => apiClient.post('/api/auth/login', data),
};

// User endpoints
export const userApi = {
  getProfile: (id) => apiClient.get(`/api/users/${id}`),
  updateProfile: (id, data) => apiClient.patch(`/api/users/${id}`, data),
  getAll: () => apiClient.get('/api/users'),
};

// Moods endpoints
export const moodApi = {
  create: (data) => apiClient.post('/api/moods', data),
  getByUser: (userId) => apiClient.get(`/api/moods/${userId}`),
};

// Resources endpoints
export const resourceApi = {
  getAll: (filters = {}) => apiClient.get('/api/resources', { params: filters }),
  create: (data) => apiClient.post('/api/resources', data),
};

// Assessments endpoints
export const assessmentApi = {
  create: (data) => apiClient.post('/api/assessments', data),
  getLatest: (userId) => apiClient.get(`/api/assessments/latest/${userId}`),
  getById: (id) => apiClient.get(`/api/assessments/${id}`),
  getAdvice: (assessmentId) => apiClient.get(`/api/assessments/${assessmentId}/advice`),
  getTemplates: (params = {}) => apiClient.get('/api/assessment-templates', { params }),
  getAvailableTemplates: () => apiClient.get('/api/assessment-templates/available'),
  createTemplate: (data) => apiClient.post('/api/assessment-templates', data),
  getTherapistTemplates: () => apiClient.get('/api/assessment-templates'),
  updateTemplate: (id, data) => apiClient.patch(`/api/assessment-templates/${id}`, data),
};

// Recommendations endpoints
export const recommendationApi = {
  getRecommendations: (userId) => apiClient.get(`/api/recommendations/${userId}`),
};

// Therapists endpoints
export const therapistApi = {
  getAll: () => apiClient.get('/api/therapists'),
  getProfile: (id) => apiClient.get(`/api/therapists/${id}`),
  updateProfile: (id, data) => apiClient.patch(`/api/therapists/${id}`, data),
  getDashboard: (id) => apiClient.get(`/api/therapists/${id}/dashboard`),
  getAppointments: (id, filters = {}) => apiClient.get(`/api/therapists/${id}/appointments`, { params: filters }),
  getAssessmentsAggregated: (id) => apiClient.get(`/api/therapists/${id}/assessments-aggregated`),
};

// Labs endpoints
export const labsApi = {
  getAll: () => apiClient.get('/api/labs'),
};

// Appointments endpoints
export const appointmentApi = {
  create: (data) => apiClient.post('/api/appointments', data),
  getNext: (userId) => apiClient.get(`/api/appointments/next/${userId}`),
  getById: (id) => apiClient.get(`/api/appointments/${id}`),
  update: (id, data) => apiClient.patch(`/api/appointments/${id}`, data),
};

// Communities endpoints
export const communityApi = {
  getAll: (filters = {}) => apiClient.get('/api/communities', { params: filters }),
  create: (data) => apiClient.post('/api/communities', data),
  join: (id, data) => apiClient.post(`/api/communities/${id}/join`, data),
  update: (id, data) => apiClient.patch(`/api/communities/${id}`, data),
  delete: (id) => apiClient.delete(`/api/communities/${id}`),
  leave: (id, userId) => apiClient.delete(`/api/communities/${id}/leave`, { data: { user_id: userId } }),
  getMembers: (id) => apiClient.get(`/api/communities/${id}/members`),
  getPosts: (id, params = {}) => apiClient.get(`/api/communities/${id}/posts`, { params }),
  createPost: (id, data) => apiClient.post(`/api/communities/${id}/posts`, data),
  getForTherapist: (therapistId) => apiClient.get(`/api/therapists/${therapistId}/communities`),
  getComments: (communityId, postId) => apiClient.get(`/api/communities/${communityId}/comments`, { params: { post_id: postId } }),
  createComment: (communityId, data) => apiClient.post(`/api/communities/${communityId}/comments`, data),
};

export const therapistPostApi = {
  getAll: (params = {}) => apiClient.get('/api/therapist-posts', { params }),
  create: (data) => apiClient.post('/api/therapist-posts', data),
  getComments: (postId) => apiClient.get(`/api/therapist-posts/${postId}/comments`),
  createComment: (postId, data) => apiClient.post(`/api/therapist-posts/${postId}/comments`, data),
  like: (postId, data) => apiClient.post(`/api/therapist-posts/${postId}/likes`, data),
  unlike: (postId, data) => apiClient.delete(`/api/therapist-posts/${postId}/likes`, { data }),
  getLikes: (postId, params = {}) => apiClient.get(`/api/therapist-posts/${postId}/likes`, { params }),
};

// Messages endpoints
export const messageApi = {
  getMessages: (userId, therapistId) => apiClient.get('/api/messages', { params: { user_id: userId, therapist_id: therapistId } }),
  sendMessage: (data) => apiClient.post('/api/messages', data),
  // Get all messages for a user across therapists
  getForUser: (userId) => apiClient.get(`/api/messages/user/${userId}`),
  // Get conversations for a therapist (list of users with last message)
  getForTherapist: (therapistId) => apiClient.get(`/api/therapists/${therapistId}/messages`),
};

// Post endpoints for likes
export const postApi = {
  getLikes: (postId, params = {}) => apiClient.get(`/api/posts/${postId}/likes`, { params }),
  like: (postId, data) => apiClient.post(`/api/posts/${postId}/likes`, data),
  unlike: (postId, data) => apiClient.delete(`/api/posts/${postId}/likes`, { data }),
};

// Notifications endpoints
export const notificationApi = {
  getNotifications: (therapistId, unread) => {
    if (unread === true) {
      return apiClient.get(`/api/therapists/${therapistId}/notifications`, { params: { unread: true } });
    }
    return apiClient.get(`/api/therapists/${therapistId}/notifications`);
  },
  markAsRead: (therapistId) => apiClient.patch(`/api/therapists/${therapistId}/notifications/mark-read`),
};

export default apiClient;
