import React, { useState, useContext } from 'react';
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
  Switch,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AuthContext from '../context/AuthContext';
import { assessmentApi } from '../api';

export default function AssessmentCreate({ navigation }) {
  const { user } = useContext(AuthContext);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentOptions, setCurrentOptions] = useState([]);
  const [currentOptionText, setCurrentOptionText] = useState('');
  const [currentOptionScore, setCurrentOptionScore] = useState('0');
  const [loading, setLoading] = useState(false);
  const [expandedQuestionIndex, setExpandedQuestionIndex] = useState(null);

  const addOption = () => {
    if (!currentOptionText.trim()) {
      Alert.alert('Error', 'Please enter an option text');
      return;
    }
    const score = parseInt(currentOptionScore) || 0;
    setCurrentOptions([...currentOptions, { text: currentOptionText, score }]);
    setCurrentOptionText('');
    setCurrentOptionScore('0');
  };

  const removeOption = (index) => {
    const updated = currentOptions.filter((_, i) => i !== index);
    setCurrentOptions(updated);
  };

  const addQuestion = () => {
    if (!currentQuestion.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }
    if (currentOptions.length === 0) {
      Alert.alert('Error', 'Please add at least one option to this question');
      return;
    }
    setQuestions([
      ...questions,
      {
        question: currentQuestion,
        options: currentOptions,
      },
    ]);
    setCurrentQuestion('');
    setCurrentOptions([]);
    setCurrentOptionText('');
    setCurrentOptionScore('0');
  };

  const removeQuestion = (index) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a diagnosis title');
      return;
    }
    if (questions.length === 0) {
      Alert.alert('Error', 'Please add at least one question');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        therapist_id: user.id,
        title: title.trim(),
        description: description.trim(),
        questions: questions.map((q) => ({
          question: q.question,
          options: q.options,
        })),
        is_published: isPublished,
      };

      await assessmentApi.createTemplate(payload);
      Alert.alert('Success', 'Diagnosis created successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error creating assessment:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to create diagnosis');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Title Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Diagnosis Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Mental Health Check-up"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
            editable={!loading}
          />
        </View>

        {/* Description Section */}
        <View style={styles.section}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe what this assessment measures"
            placeholderTextColor="#9CA3AF"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            editable={!loading}
          />
        </View>

        {/* Published Toggle */}
        <View style={styles.section}>
          <View style={styles.toggleContainer}>
            <Text style={styles.label}>Publish for Patients</Text>
            <Switch
              value={isPublished}
              onValueChange={setIsPublished}
              disabled={loading}
              trackColor={{ false: '#D1D5DB', true: '#4A90E2' }}
              thumbColor={isPublished ? '#0B61C6' : '#F3F4F6'}
            />
          </View>
          <Text style={styles.helperText}>
            Published diagnoses will be available for patients to take
          </Text>
        </View>

        {/* Add Question Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Questions</Text>

          <View style={styles.questionForm}>
            <Text style={styles.label}>Question *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., How often do you feel anxious?"
              placeholderTextColor="#9CA3AF"
              value={currentQuestion}
              onChangeText={setCurrentQuestion}
              editable={!loading}
            />

            <Text style={[styles.label, styles.optionsLabel]}>Options</Text>

            {/* Add Option Inputs */}
            <View style={styles.optionInputContainer}>
              <TextInput
                style={[styles.input, styles.optionTextInput]}
                placeholder="Option text"
                placeholderTextColor="#9CA3AF"
                value={currentOptionText}
                onChangeText={setCurrentOptionText}
                editable={!loading}
              />
              <TextInput
                style={[styles.input, styles.optionScoreInput]}
                placeholder="Score (0-100)"
                placeholderTextColor="#9CA3AF"
                value={currentOptionScore}
                onChangeText={setCurrentOptionScore}
                keyboardType="numeric"
                editable={!loading}
              />
              <TouchableOpacity
                style={[styles.addOptionButton, loading && styles.disabledButton]}
                onPress={addOption}
                disabled={loading}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Current Options List */}
            {currentOptions.length > 0 && (
              <View style={styles.optionsList}>
                <Text style={styles.subLabel}>Current Options:</Text>
                {currentOptions.map((option, idx) => (
                  <View key={idx} style={styles.optionItem}>
                    <View style={styles.optionContent}>
                      <Text style={styles.optionText}>{option.text}</Text>
                      <Text style={styles.optionScore}>Score: {option.score}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeOption(idx)}
                      disabled={loading}
                    >
                      <Ionicons name="close-circle" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[styles.addQuestionButton, loading && styles.disabledButton]}
              onPress={addQuestion}
              disabled={loading}
            >
              <Ionicons name="add" size={18} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.addQuestionText}>Add Question</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Questions List */}
        {questions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Questions ({questions.length})
            </Text>
            {questions.map((q, idx) => (
              <View key={idx} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <TouchableOpacity
                    style={styles.questionHeaderButton}
                    onPress={() =>
                      setExpandedQuestionIndex(
                        expandedQuestionIndex === idx ? null : idx
                      )
                    }
                  >
                    <Text style={styles.questionCardTitle}>
                      Q{idx + 1}: {q.question}
                    </Text>
                    <Ionicons
                      name={
                        expandedQuestionIndex === idx
                          ? 'chevron-up'
                          : 'chevron-down'
                      }
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeQuestion(idx)}
                    disabled={loading}
                  >
                    <Ionicons name="trash" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>

                {expandedQuestionIndex === idx && (
                  <View style={styles.questionOptions}>
                    {q.options.map((option, optIdx) => (
                      <View key={optIdx} style={styles.optionDisplay}>
                        <Text style={styles.optionDisplayText}>
                          • {option.text}
                        </Text>
                        <Text style={styles.optionDisplayScore}>
                          {option.score} pts
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            (loading || !title.trim() || questions.length === 0) &&
              styles.disabledButton,
          ]}
          onPress={handleSave}
          disabled={loading || !title.trim() || questions.length === 0}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="save" size={18} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.saveButtonText}>Save Diagnosis</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scroll: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  optionsLabel: {
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2937',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  questionForm: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionInputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  optionTextInput: {
    flex: 1,
  },
  optionScoreInput: {
    width: 90,
  },
  addOptionButton: {
    backgroundColor: '#4A90E2',
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsList: {
    marginBottom: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '500',
  },
  optionScore: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  addQuestionButton: {
    backgroundColor: '#0B61C6',
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addQuestionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 6,
  },
  questionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    overflow: 'hidden',
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  questionHeaderButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  questionCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  questionOptions: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  optionDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  optionDisplayText: {
    fontSize: 13,
    color: '#374151',
    flex: 1,
  },
  optionDisplayScore: {
    fontSize: 12,
    color: '#0B61C6',
    fontWeight: '600',
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  saveButton: {
    backgroundColor: '#0B61C6',
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
