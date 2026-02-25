import React, { useCallback, useContext, useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthContext from '../context/AuthContext';
import { assessmentApi, therapistApi, appointmentApi } from '../api';

export default function AssessmentsScreen({ navigation }) {
  const { user } = useContext(AuthContext);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await assessmentApi.getAvailableTemplates();
      const data = Array.isArray(resp.data) ? resp.data : [];
      setTemplates(data);
    } catch (error) {
      console.warn('Failed to load diagnoses', error);
      Alert.alert('Error', 'Failed to load diagnoses.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleTakeAssessment = (template) => {
    setSelectedTemplate(template);
    setShowForm(true);
  };

  const handleBackFromForm = () => {
    setShowForm(false);
    setSelectedTemplate(null);
    loadTemplates();
  };

  if (showForm && selectedTemplate) {
    return (
      <AssessmentTakeForm
        template={selectedTemplate}
        user={user}
        onBack={handleBackFromForm}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Diagnoses</Text>
            <View style={styles.homePill}>
              <Text style={styles.homeText}>Home</Text>
            </View>
          </View>
          <Text style={styles.subheading}>Available Diagnoses</Text>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#0b61c6" size="large" />
            </View>
          ) : templates.length ? (
            templates.map((template) => {
              let questionsText = 'questions';
              try {
                let q = [];
                if (template.questions_json) {
                  q = JSON.parse(template.questions_json || '[]');
                } else if (Array.isArray(template.questions)) {
                  q = template.questions;
                } else if (template.questions && typeof template.questions === 'string') {
                  q = JSON.parse(template.questions || '[]');
                }
                questionsText = `${q.length} question${q.length !== 1 ? 's' : ''}`;
              } catch {}
              return (
                <View style={styles.listItem} key={`template-${template.id}`}>
                  <View>
                    <Text style={styles.itemTitle}>{template.title}</Text>
                    <Text style={styles.itemSubtitle}>{questionsText}</Text>
                    <Text style={styles.itemDate}>
                      Created: {new Date(template.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.takeButton}
                    onPress={() => handleTakeAssessment(template)}
                  >
                    <Text style={styles.takeText}>Take</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>No diagnoses available yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AssessmentTakeForm({ template, user, onBack }) {
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [resultAssessmentId, setResultAssessmentId] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Parse questions from either `questions_json` (string) or `questions` (array)
  let rawQuestions = [];
  try {
    if (template.questions_json) {
      rawQuestions = JSON.parse(template.questions_json || '[]');
    } else if (Array.isArray(template.questions)) {
      rawQuestions = template.questions;
    } else if (template.questions && typeof template.questions === 'string') {
      // sometimes backend returns a JSON string in `questions`
      rawQuestions = JSON.parse(template.questions || '[]');
    }
  } catch (e) {
    rawQuestions = [];
  }

  // Normalize questions/options shape to { question, options: [{ label, score }] }
  const questions = rawQuestions.map((rq) => {
    let opts = [];
    if (Array.isArray(rq.options)) {
      opts = rq.options;
    } else if (rq.options_json) {
      try {
        opts = JSON.parse(rq.options_json || '[]');
      } catch {
        opts = [];
      }
    } else if (rq.options && typeof rq.options === 'string') {
      // comma-separated or JSON
      try {
        opts = JSON.parse(rq.options);
        if (!Array.isArray(opts)) opts = rq.options.split(',').map((s) => s.trim());
      } catch {
        opts = rq.options.split(',').map((s) => s.trim());
      }
    }

    const normalizedOptions = (Array.isArray(opts) ? opts : []).map((o, i, arr) => {
      // primitive string or number -> map to 100..25 descending
      if (typeof o === 'string' || typeof o === 'number') {
        const label = String(o);
        const n = arr.length || 1;
        const step = n > 1 ? (100 - 25) / (n - 1) : 0;
        const score = Math.round(100 - i * step);
        return { label, score };
      }

      // object shape
      const label = o.label || o.text || o.option || o.title || '';
      const score = typeof o.score !== 'undefined' ? Number(o.score) : (typeof o.value !== 'undefined' ? Number(o.value) : 0);
      return { label, score };
    });

    // If all option scores are 0 (or missing), remap them to 100,75,50,25 descending
    const allZero = normalizedOptions.length > 0 && normalizedOptions.every((o) => Number(o.score || 0) === 0);
    if (allZero) {
      const n = normalizedOptions.length;
      const step = n > 1 ? (100 - 25) / (n - 1) : 0;
      normalizedOptions.forEach((opt, idx) => {
        opt.score = Math.round(100 - idx * step);
      });
    }

    // sort options by score descending so highest appears first (100,75,50,25)
    normalizedOptions.sort((a, b) => (Number(b.score || 0) - Number(a.score || 0)));

    return {
      question: rq.question || rq.text || rq.prompt || '',
      options: normalizedOptions,
    };
  });

  const handleSelectOption = (questionIndex, optionScore) => {
    const numeric = Number(optionScore);
    setAnswers((prev) => ({
      ...prev,
      [questionIndex]: numeric,
    }));
    // clear validation error for this question (if any)
    setValidationErrors((prev) => {
      if (!prev || !prev[questionIndex]) return prev;
      const copy = { ...prev };
      delete copy[questionIndex];
      return copy;
    });
  };

  const handleSubmit = async () => {
    // per-question validation: mark unanswered
    const missing = questions.map((_, idx) => (typeof answers[idx] === 'undefined'));
    const anyMissing = missing.some(Boolean);
    if (anyMissing) {
      const newErrors = {};
      missing.forEach((m, i) => { if (m) newErrors[i] = true; });
      setValidationErrors(newErrors);
      Alert.alert('Validation', 'Please answer all questions.');
      return;
    }
    setValidationErrors({});

    setSubmitting(true);
    try {
      const scores = questions.map((_, idx) => Number(answers[idx] || 0));

      // compute total possible score as sum of each question's max option score
      const totalPossible = questions.reduce((sum, q) => {
        const maxForQ = Array.isArray(q.options) && q.options.length ? Math.max(...q.options.map((o) => Number(o.score || 0))) : 0;
        return sum + maxForQ;
      }, 0) || 1;

      const totalObtained = scores.reduce((a, b) => a + b, 0);
      const totalPercent = Math.round((totalObtained / totalPossible) * 100);

      const resp = await assessmentApi.create({
        user_id: user.id,
        total_percent: totalPercent,
        details: {
          template_id: template.id,
          template_title: template.title,
          questions_count: questions.length,
          answers: answers,
        },
        template_id: template.id,
      });

      if (resp.data?.id) {
        setResultAssessmentId(resp.data.id);
        setShowResults(true);
      }
    } catch (error) {
      console.warn('Failed to submit diagnosis', error);
      Alert.alert('Error', 'Failed to submit diagnosis.');
    } finally {
      setSubmitting(false);
    }
  };

  if (showResults) {
    return <AssessmentResultsView assessmentId={resultAssessmentId} user={user} onBack={onBack} />;
  }

  if (!questions.length) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>No questions found.</Text>
          <TouchableOpacity onPress={onBack} style={styles.backButtonLarge}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const q = questions[currentQuestion];
  const selectedAnswer = typeof answers[currentQuestion] !== 'undefined' ? answers[currentQuestion] : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <TouchableOpacity onPress={onBack} style={styles.backButtonSmall}>
            <Ionicons name="chevron-back" size={20} color="#0b61c6" />
            <Text style={styles.backSmallText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.sectionIntro}>Answer all questions below</Text>

            {questions.map((questionItem, qi) => {
            const sel = typeof answers[qi] !== 'undefined' ? answers[qi] : null;
              const invalid = !!validationErrors[qi];
              return (
              <View key={`q-${qi}`} style={[styles.questionBlock, invalid && styles.questionBlockInvalid]}>
                <Text style={styles.questionTextLarge}>{`${qi + 1}. ${questionItem.question}`}</Text>
                <View style={styles.optionsContainer}>
                  {Array.isArray(questionItem.options) && questionItem.options.map((opt, idx) => (
                    <TouchableOpacity
                      key={`opt-${qi}-${idx}`}
                      style={[
                        styles.optionButton,
                        sel === opt.score && styles.optionButtonSelected,
                      ]}
                      onPress={() => handleSelectOption(qi, opt.score)}
                    >
                      <View style={styles.optionContent}>
                        <Text style={[styles.optionText, sel === opt.score && styles.optionTextSelected]}>{opt.label}</Text>
                        <Text style={[styles.scoreText, sel === opt.score && styles.scoreTextSelected]}>{opt.score} pts</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
                {invalid && <Text style={styles.questionErrorText}>Please answer this question.</Text>}
              </View>
            );
          })}

          <View style={styles.allSubmitRow}>
            <TouchableOpacity
              style={[styles.submitButton, (submitting || Object.keys(answers).length !== questions.length) && styles.submitButtonDisabled]}
              disabled={submitting || Object.keys(answers).length !== questions.length}
              onPress={handleSubmit}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>Submit</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AssessmentResultsView({ assessmentId, user, onBack }) {
  const [assessment, setAssessment] = useState(null);
  const [advice, setAdvice] = useState(null);
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!assessmentId) return;
    setLoading(true);
    try {
      const latestResp = await assessmentApi.getLatest(user?.id);
      if (latestResp.data) {
        setAssessment(latestResp.data);
        const adviceResp = await assessmentApi.getAdvice(latestResp.data.id);
        setAdvice(adviceResp.data);
      }

      const therapistsResp = await therapistApi.getAll();
      setTherapists(Array.isArray(therapistsResp.data) ? therapistsResp.data : []);
    } catch (error) {
      console.warn('Failed to load results', error);
    } finally {
      setLoading(false);
    }
  }, [assessmentId, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleBookAppointment = async (therapist) => {
    if (!user?.id || !therapist?.id) {
      Alert.alert('Error', 'Unable to book appointment.');
      return;
    }

    Alert.alert(
      'Book Appointment',
      `Book a session with ${therapist.name}?`,
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Book',
          onPress: async () => {
            try {
              await appointmentApi.create({
                user_id: user.id,
                therapist_id: therapist.id,
                status: 'pending',
              });
              Alert.alert('Success', 'Appointment request sent!');
            } catch (error) {
              console.warn('Failed to book appointment', error);
              Alert.alert('Error', 'Failed to book appointment.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0b61c6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!assessment) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Assessment not found.</Text>
          <TouchableOpacity onPress={onBack} style={styles.backButtonLarge}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const scorePercentage = assessment.total_percent || 0;
  const scoreStatus =
    scorePercentage >= 75
      ? 'Excellent'
      : scorePercentage >= 50
      ? 'Good'
      : scorePercentage >= 25
      ? 'Fair'
      : 'Low';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#0b61c6" />
          </TouchableOpacity>

          <View style={styles.scoreSection}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>{scorePercentage}%</Text>
              <Text style={styles.scoreLabel}>{scoreStatus}</Text>
            </View>
            <Text style={styles.scoreDescription}>
              Your mental health status: You are managing well emotionally.
            </Text>
          </View>

          {advice && (
            <View style={styles.adviceSection}>
              <View style={styles.adviceHeader}>
                <Ionicons name="sparkles" size={20} color="#6b4fd9" />
                <Text style={styles.adviceTitle}>
                  {advice.title || 'Personalized Recommendations'}
                </Text>
              </View>
              <Text style={styles.adviceIntro}>
                {advice.intro ||
                  'Based on your assessment results, here are personalized recommendations.'}
              </Text>
              {Array.isArray(advice.actions) && advice.actions.length > 0 && (
                <View style={styles.actionsList}>
                  {advice.actions.map((action, idx) => (
                    <View key={`action-${idx}`} style={styles.actionItem}>
                      <Text style={styles.actionNumber}>{idx + 1}</Text>
                      <Text style={styles.actionText}>{action}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          <View style={styles.bookingSection}>
            <View style={styles.bookingHeader}>
              <Ionicons name="calendar" size={20} color="#0b61c6" />
              <Text style={styles.bookingTitle}>Need support? Book a session</Text>
            </View>

            {therapists.length > 0 ? (
              <View style={styles.therapistList}>
                {therapists.slice(0, 3).map((therapist) => (
                  <View key={`therapist-${therapist.id}`} style={styles.therapistCard}>
                    <View style={styles.therapistInfo}>
                      <View style={styles.therapistAvatar}>
                        <Ionicons name="person-circle" size={32} color="#6b4fd9" />
                      </View>
                      <View style={styles.therapistDetails}>
                        <Text style={styles.therapistName}>{therapist.name}</Text>
                        <Text style={styles.therapistSpecialization}>
                          {therapist.specialization || 'Therapist'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.bookButton}
                      onPress={() => handleBookAppointment(therapist)}
                    >
                      <Text style={styles.bookButtonText}>Book</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.noTherapistsText}>No therapists available.</Text>
            )}
          </View>

          <TouchableOpacity style={styles.exportButton}>
            <Ionicons name="download-outline" size={18} color="#fff" />
            <Text style={styles.exportButtonText}>Export PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareButton}>
            <Ionicons name="share-social-outline" size={18} color="#0b61c6" />
            <Text style={styles.shareButtonText}>Share Results</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.homeButton} onPress={onBack}>
            <Text style={styles.homeButtonText}>Back to Diagnoses</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  scroll: {
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 28,
    backgroundColor: '#fff',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0b3a69',
  },
  homePill: {
    backgroundColor: '#f5f1eb',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  homeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333333',
  },
  subheading: {
    fontSize: 14,
    color: '#1f437f',
    marginBottom: 12,
  },
  loadingRow: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f7ff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1b1c2b',
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#6c6c81',
    marginTop: 2,
  },
  itemDate: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  takeButton: {
    backgroundColor: '#000',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 24,
  },
  takeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  emptyText: {
    fontSize: 13,
    color: '#8c8c8c',
    textAlign: 'center',
    paddingVertical: 20,
  },
  backButton: {
    padding: 8,
    marginBottom: 12,
  },
  backButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  backSmallText: {
    color: '#0b61c6',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionIntro: {
    fontSize: 13,
    color: '#6b6d80',
    marginBottom: 12,
  },
  questionBlock: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef2ff',
  },
  questionTextLarge: {
    fontSize: 15,
    fontWeight: '700',
    color: '#161616',
    marginBottom: 10,
  },
  allSubmitRow: {
    marginTop: 12,
    alignItems: 'center',
  },
  backButtonLarge: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#0b61c6',
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8c8c8c',
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e3e6f0',
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0b61c6',
  },
  questionText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#161616',
    marginBottom: 16,
    lineHeight: 24,
  },
  optionsContainer: {
    marginBottom: 20,
  },
  optionButton: {
    borderWidth: 2,
    borderColor: '#e3e6f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#f9fafc',
  },
  optionButtonSelected: {
    borderColor: '#034ea2',
    backgroundColor: '#0b61c6',
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#161616',
    flex: 1,
  },
  optionTextSelected: {
    color: '#fff',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8c8c8c',
    marginLeft: 10,
  },
  scoreTextSelected: {
    color: '#fff',
  },
  questionBlockInvalid: {
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  questionErrorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 8,
  },
  navigationRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  navButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#e8f0ff',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0b61c6',
  },
  navButtonDisabled: {
    backgroundColor: '#f0f0f0',
    borderColor: '#d0d0d0',
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0b61c6',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0b61c6',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#a7bbde',
  },
  submitButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  errorText: {
    fontSize: 15,
    color: '#e02a3f',
  },
  scoreSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#e8f0ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 4,
    borderColor: '#0b61c6',
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#0b61c6',
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a4a4a',
    marginTop: 4,
  },
  scoreDescription: {
    fontSize: 13,
    color: '#6b6d80',
    textAlign: 'center',
    lineHeight: 18,
  },
  adviceSection: {
    backgroundColor: '#f9fafc',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  adviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  adviceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#161616',
    marginLeft: 8,
  },
  adviceIntro: {
    fontSize: 12,
    color: '#6b6d80',
    marginBottom: 12,
    lineHeight: 16,
  },
  actionsList: {
    marginTop: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  actionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#0b61c6',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '700',
    marginRight: 10,
    fontSize: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 12,
    color: '#4a4a4a',
    lineHeight: 16,
  },
  bookingSection: {
    backgroundColor: '#f5f1eb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  bookingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bookingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#161616',
    marginLeft: 8,
  },
  therapistList: {
    gap: 10,
  },
  therapistCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e3e6f0',
  },
  therapistInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  therapistAvatar: {
    marginRight: 10,
  },
  therapistDetails: {
    flex: 1,
  },
  therapistName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#161616',
  },
  therapistSpecialization: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 2,
  },
  bookButton: {
    backgroundColor: '#0b61c6',
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  noTherapistsText: {
    fontSize: 12,
    color: '#8c8c8c',
    textAlign: 'center',
    paddingVertical: 16,
  },
  exportButton: {
    backgroundColor: '#000',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  shareButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#0b61c6',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  shareButtonText: {
    color: '#0b61c6',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  homeButton: {
    backgroundColor: '#e8f0ff',
    borderWidth: 1,
    borderColor: '#0b61c6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  homeButtonText: {
    color: '#0b61c6',
    fontSize: 13,
    fontWeight: '700',
  },
});