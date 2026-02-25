import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import AuthContext from '../context/AuthContext';
import { appointmentApi, therapistApi } from '../api';

export default function BookSession({ route, navigation }) {
  const { therapist: initialTherapist } = route.params || {};
  const { user } = useContext(AuthContext);
  
  const [step, setStep] = useState(initialTherapist ? 'form' : 'selectTherapist'); // selectTherapist, form
  const [therapists, setTherapists] = useState([]);
  const [selectedTherapist, setSelectedTherapist] = useState(initialTherapist || null);
  const [loading, setLoading] = useState(false);
  const [loadingTherapists, setLoadingTherapists] = useState(false);
  const [therapistAppointments, setTherapistAppointments] = useState([]);
  
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedDateObj, setSelectedDateObj] = useState(null);
  const [showWebCalendar, setShowWebCalendar] = useState(false);
  const [webCalendarMonth, setWebCalendarMonth] = useState(() => {
    const d = selectedDateObj || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Web fallback: hidden inputs we can click via ref (more reliable than creating elements)
  const webDateRef = useRef(null);
  const webTimeRef = useRef(null);

  const handleWebDateChange = (e) => {
    const val = e?.target?.value; // yyyy-mm-dd
    if (!val) return;
    const parts = val.split('-');
    const picked = new Date(parts[0], parseInt(parts[1], 10) - 1, parts[2]);
    setSelectedDateObj((prev) => {
      const base = prev || new Date();
      const newD = new Date(picked);
      newD.setHours(base.getHours(), base.getMinutes(), 0, 0);
      return newD;
    });
    setDate(formatDateDisplay(picked));
    (async () => {
      const ok = await checkTherapistAvailability(selectedTherapist?.id, picked);
      if (!ok) {
        setDate('');
        setSelectedDateObj(null);
        Alert.alert('Unavailable', 'Therapist is not available on that date. Please choose another date.');
      }
    })();
  };

  const handleWebTimeChange = (e) => {
    const val = e?.target?.value; // HH:MM
    if (!val) return;
    setTime(val);
    setSelectedDateObj((prev) => {
      const base = prev || new Date();
      const newD = new Date(base);
      const [hh, mm] = val.split(':').map((x) => parseInt(x, 10));
      newD.setHours(hh, mm, 0, 0);
      return newD;
    });
  };

  // Simpler web fallback: use prompt() to get date/time from the user
  const openWebPromptDate = async () => {
    try {
      const val = window.prompt('Enter date (mm/dd/yyyy)');
      if (!val) return;
      const parts = val.split('/');
      if (parts.length !== 3) return Alert.alert('Invalid', 'Please enter date as mm/dd/yyyy');
      const mm = parseInt(parts[0], 10);
      const dd = parseInt(parts[1], 10);
      const yyyy = parseInt(parts[2], 10);
      const picked = new Date(yyyy, mm - 1, dd);
      if (Number.isNaN(picked.getTime())) return Alert.alert('Invalid', 'Invalid date');
      setSelectedDateObj((prev) => {
        const base = prev || new Date();
        const newD = new Date(picked);
        newD.setHours(base.getHours(), base.getMinutes(), 0, 0);
        return newD;
      });
      setDate(val);
      const ok = await checkTherapistAvailability(selectedTherapist?.id, picked);
      if (!ok) {
        setDate('');
        setSelectedDateObj(null);
        return Alert.alert('Unavailable', 'Therapist is not available on that date. Please choose another date.');
      }
    } catch (err) {
      console.warn('Prompt date error', err);
    }
  };

  const openWebPromptTime = async () => {
    try {
      const val = window.prompt('Enter time (HH:MM, 24-hour)');
      if (!val) return;
      const parts = val.split(':');
      if (parts.length !== 2) return Alert.alert('Invalid', 'Please enter time as HH:MM');
      const hh = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10);
      if (Number.isNaN(hh) || Number.isNaN(mm)) return Alert.alert('Invalid', 'Invalid time');
      setTime(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
      setSelectedDateObj((prev) => {
        const base = prev || new Date();
        const newD = new Date(base);
        newD.setHours(hh, mm, 0, 0);
        return newD;
      });
    } catch (err) {
      console.warn('Prompt time error', err);
    }
  };

  const loadTherapists = useCallback(async () => {
    setLoadingTherapists(true);
    try {
      const resp = await therapistApi.getAll();
      const data = Array.isArray(resp.data) ? resp.data : [];
      setTherapists(data);
    } catch (e) {
      console.warn('Failed to load therapists', e);
      Alert.alert('Error', 'Failed to load therapists');
    } finally {
      setLoadingTherapists(false);
    }
  }, []);

  const loadTherapistAppointments = useCallback(async (therapistId) => {
    if (!therapistId) return setTherapistAppointments([]);
    try {
      const resp = await therapistApi.getAppointments(therapistId);
      const appts = Array.isArray(resp.data) ? resp.data : resp;
      // only future or upcoming appointments
      const now = new Date();
      const upcoming = appts.filter(a => a.starts_at && new Date(a.starts_at) >= now && (!a.status || a.status !== 'cancelled'));
      setTherapistAppointments(upcoming);
    } catch (err) {
      console.warn('Failed to load therapist appointments', err);
      setTherapistAppointments([]);
    }
  }, []);

  useEffect(() => {
    if (step === 'selectTherapist') {
      loadTherapists();
    }
  }, [step, loadTherapists]);

  // Load therapist appointments when selected therapist changes or when entering the form
  useEffect(() => {
    if (step === 'form' && selectedTherapist?.id) {
      loadTherapistAppointments(selectedTherapist.id);
    }
  }, [step, selectedTherapist, loadTherapistAppointments]);

  const handleSelectTherapist = (therapist) => {
    setSelectedTherapist(therapist);
    setStep('form');
  };

  const handleBook = async () => {
    if (!user?.id) return Alert.alert('Error', 'Please log in to book.');
    if (!selectedTherapist?.id) return Alert.alert('Error', 'Please select a therapist.');
    if (!date || !time) return Alert.alert('Error', 'Please choose date and time from the calendar.');
    
    // Prevent booking on past dates
    if (selectedDateObj) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDateObj < today) {
        return Alert.alert('Invalid', 'Cannot book on past dates. Please choose a future date.');
      }
    }

    // Build ISO timestamp from selected date/time (preserve local time, don't convert to UTC)
    let startsAt;
    try {
      const base = selectedDateObj || new Date();
      // parse time which could be like '14:30' or '2:30 PM'
      const timeParts = time.match(/(\d{1,2}):(\d{2})/);
      if (timeParts) {
        const hh = parseInt(timeParts[1], 10);
        const mm = parseInt(timeParts[2], 10);
        
        // Build ISO string manually to preserve local time without UTC conversion
        const yyyy = String(base.getFullYear());
        const m = String(base.getMonth() + 1).padStart(2, '0');
        const d = String(base.getDate()).padStart(2, '0');
        const h = String(hh).padStart(2, '0');
        const min = String(mm).padStart(2, '0');
        
        // Format without 'Z' to indicate local time: YYYY-MM-DDTHH:mm:ss
        startsAt = `${yyyy}-${m}-${d}T${h}:${min}:00`;
      } else {
        // If no time parsed, use ISO but this shouldn't happen
        const dt = new Date(base);
        dt.setHours(0);
        dt.setMinutes(0);
        dt.setSeconds(0);
        dt.setMilliseconds(0);
        const yyyy = String(dt.getFullYear());
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        startsAt = `${yyyy}-${m}-${d}T00:00:00`;
      }
    } catch (e) {
      console.warn('Error building timestamp', e);
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const yyyy = String(tomorrow.getFullYear());
      const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const d = String(tomorrow.getDate()).padStart(2, '0');
      startsAt = `${yyyy}-${m}-${d}T09:00:00`;
    }

    // Final availability check before creating
    try {
      const ok = await checkTherapistAvailability(selectedTherapist.id, selectedDateObj);
      if (!ok) {
        setLoading(false);
        return Alert.alert('Unavailable', 'Therapist is not available on that date. Please choose another date.');
      }
    } catch (e) {
      console.warn('Availability check failed', e);
    }

    setLoading(true);
    try {
      await appointmentApi.create({
        user_id: user.id,
        therapist_id: selectedTherapist.id,
        starts_at: startsAt,
        reason: reason || 'Appointment request',
      });
      Alert.alert('Success', `Appointment request sent to ${selectedTherapist.name}!`);
      navigation.goBack();
    } catch (error) {
      console.warn('Booking failed', error);
      Alert.alert('Error', 'Failed to book appointment.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateDisplay = (d) => {
    if (!d) return '';
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  };

  const formatTimeDisplay = (d) => {
    if (!d) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const formatTime12 = (d) => {
    if (!d) return '';
    let hh = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, '0');
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12;
    if (hh === 0) hh = 12;
    return `${String(hh).padStart(2, '0')}:${mm} ${ampm}`;
  };

  const sameLocalDate = (a, b) => {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };

  const checkTherapistAvailability = async (therapistId, dateObj) => {
    if (!therapistId || !dateObj) return true; // nothing to check
    try {
      // Prefer cached appointments when available
      const appts = therapistAppointments.length ? therapistAppointments : (Array.isArray((await therapistApi.getAppointments(therapistId)).data) ? (await therapistApi.getAppointments(therapistId)).data : []);
      const conflict = appts.find((a) => {
        if (!a.starts_at) return false;
        const aDateObj = new Date(a.starts_at);
        // consider any non-cancelled appointment on that date a conflict
        return sameLocalDate(aDateObj, dateObj) && (!a.status || a.status !== 'cancelled');
      });
      return !conflict;
    } catch (err) {
      console.warn('Failed to check availability', err);
      return true; // fail open to avoid blocking booking when API fails
    }
  };

  const isDateBooked = (dateObj) => {
    if (!dateObj || !therapistAppointments) return false;
    return therapistAppointments.some(a => a.starts_at && sameLocalDate(new Date(a.starts_at), dateObj) && (!a.status || a.status !== 'cancelled'));
  };

  if (step === 'selectTherapist') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.title}>Select a Therapist</Text>
        </View>

        {loadingTherapists ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#0b61c6" />
          </View>
        ) : therapists.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No therapists available</Text>
          </View>
        ) : (
          <FlatList
            data={therapists}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.therapistOption}
                onPress={() => handleSelectTherapist(item)}
              >
                <View style={styles.optionAvatar} />
                <View style={styles.optionInfo}>
                  <Text style={styles.optionName}>{item.name}</Text>
                  <Text style={styles.optionRole}>{item.specialization || item.role || 'Therapist'}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setStep('selectTherapist')} style={styles.backButton}>
            <Ionicons name="chevron-back" size={22} color="#111" />
          </TouchableOpacity>
          <Text style={styles.title}>Book a Session</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.therapistCard}>
            <View style={styles.avatar} />
            <Text style={styles.name}>{selectedTherapist?.name || 'Therapist'}</Text>
            <Text style={styles.role}>{selectedTherapist?.specialization || selectedTherapist?.role || ''}</Text>
            <TouchableOpacity
              style={styles.changeButton}
              onPress={() => setStep('selectTherapist')}
            >
              <Text style={styles.changeButtonText}>Change Therapist</Text>
            </TouchableOpacity>
          </View>

          {/* Show booked dates/times for selected therapist */}
          {therapistAppointments.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontWeight: '700', marginBottom: 6 }}>Booked slots (upcoming)</Text>
              {/** group by date */}
              {Array.from(therapistAppointments.reduce((m, a) => {
                if (!a.starts_at) return m;
                const d = new Date(a.starts_at);
                const key = `${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
                if (!m.has(key)) m.set(key, []);
                m.get(key).push(d);
                return m;
              }, new Map())).map(([dateKey, times]) => (
                <View key={dateKey} style={{ marginBottom: 8 }}>
                  <Text style={{ color: '#333', fontWeight: '600' }}>{dateKey}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
                    {times.map((t, idx) => (
                      <View key={idx} style={{ backgroundColor: '#eee', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, marginRight: 6, marginBottom: 6 }}>
                        <Text style={{ fontSize: 12 }}>{formatTime12(t)}{isDateBooked(t) ? ' • Booked' : ''}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.label}>Choose date</Text>
          {Platform.OS === 'web' ? (
            <>
              <TouchableOpacity style={[styles.input, styles.pickerButton]} onPress={() => setShowWebCalendar((s) => !s)}>
                <Text style={{ color: date ? '#111' : '#aaa' }}>{date || 'Select date'}</Text>
              </TouchableOpacity>
              {showWebCalendar && (
                <View style={styles.webCalendar}>
                  <View style={styles.webCalHeader}>
                    <TouchableOpacity onPress={() => setWebCalendarMonth(new Date(webCalendarMonth.getFullYear(), webCalendarMonth.getMonth() - 1, 1))}>
                      <Text style={styles.webCalNav}>&lt;</Text>
                    </TouchableOpacity>
                    <Text style={styles.webCalMonth}>{webCalendarMonth.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</Text>
                    <TouchableOpacity onPress={() => setWebCalendarMonth(new Date(webCalendarMonth.getFullYear(), webCalendarMonth.getMonth() + 1, 1))}>
                      <Text style={styles.webCalNav}>&gt;</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.webCalGrid}>
                    {['Su','Mo','Tu','We','Th','Fr','Sa'].map((h) => (
                      <Text key={h} style={styles.webCalDayHeader}>{h}</Text>
                    ))}
                      {(() => {
                      const first = new Date(webCalendarMonth.getFullYear(), webCalendarMonth.getMonth(), 1);
                      const startDay = first.getDay();
                      const daysInMonth = new Date(webCalendarMonth.getFullYear(), webCalendarMonth.getMonth()+1, 0).getDate();
                      const cells = [];
                      for (let i = 0; i < startDay; i++) cells.push(null);
                      for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(webCalendarMonth.getFullYear(), webCalendarMonth.getMonth(), d));
                      // render 42 cells
                      while (cells.length < 42) cells.push(null);
                        const todayMid = new Date();
                        todayMid.setHours(0,0,0,0);
                        return cells.map((cell, idx) => {
                          if (!cell) return <View key={idx} style={styles.webCalCell} />;
                          const isBooked = isDateBooked(cell);
                          const isToday = sameLocalDate(cell, new Date());
                          const isPast = cell < todayMid;
                          const cellStyle = [
                            styles.webCalCell,
                            isBooked && styles.webCalBooked,
                            isToday && styles.webCalToday,
                            isPast && styles.webCalPast,
                          ];
                          const textStyle = [styles.webCalCellText, isBooked && styles.webCalCellTextBooked, isPast && styles.webCalCellTextPast];
                          if (isBooked || isPast) {
                            return (
                              <View key={idx} style={[cellStyle, { pointerEvents: 'none', cursor: 'not-allowed' }]}>
                                <Text style={textStyle}>{cell.getDate()}</Text>
                              </View>
                            );
                          }
                          return (
                            <TouchableOpacity
                              key={idx}
                              style={cellStyle}
                              onPress={() => {
                                setSelectedDateObj(new Date(cell));
                                setDate(formatDateDisplay(cell));
                                setShowWebCalendar(false);
                              }}
                            >
                              <Text style={textStyle}>{cell.getDate()}</Text>
                            </TouchableOpacity>
                          );
                        });
                    })()}
                  </View>
                </View>
              )}
            </>
          ) : (
            <TouchableOpacity
              style={[styles.input, styles.pickerButton]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: date ? '#111' : '#aaa' }}>{date || 'Select date'}</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.label}>Choose time</Text>
          {Platform.OS === 'web' ? (
            <input
              type="time"
              value={time}
              onChange={handleWebTimeChange}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                border: '1px solid #e6e6e6',
                background: '#f9f9f9',
                marginTop: 6,
                boxSizing: 'border-box',
              }}
            />
          ) : (
            <TouchableOpacity
              style={[styles.input, styles.pickerButton]}
              onPress={() => setShowTimePicker(true)}
            >
              <Text style={{ color: time ? '#111' : '#aaa' }}>{time || 'Select time'}</Text>
            </TouchableOpacity>
          )}

          {(showDatePicker || showTimePicker) && (
            <DateTimePicker
              value={selectedDateObj || new Date()}
              mode={showDatePicker ? 'date' : 'time'}
              minimumDate={(() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return today;
              })()}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, picked) => {
                // Android: event.type === 'dismissed' means cancelled
                if (event?.type === 'dismissed') {
                  setShowDatePicker(false);
                  setShowTimePicker(false);
                  return;
                }
                if (!picked) return;
                  if (showDatePicker) {
                  setSelectedDateObj((prev) => {
                    const base = prev || new Date();
                    // keep time portion if already set
                    const newD = new Date(picked);
                    newD.setHours(base.getHours(), base.getMinutes(), 0, 0);
                    return newD;
                  });
                  // If date is booked (from cached appointments), clear and alert
                  setDate(formatDateDisplay(picked));
                  setShowDatePicker(false);
                  if (isDateBooked(picked)) {
                    setDate('');
                    setSelectedDateObj(null);
                    return Alert.alert('Unavailable', 'Therapist is not available on that date. Please choose another date.');
                  }
                  // otherwise double-check availability
                  (async () => {
                    try {
                      const ok = await checkTherapistAvailability(selectedTherapist?.id, picked);
                      if (!ok) {
                        setDate('');
                        setSelectedDateObj(null);
                        Alert.alert('Unavailable', 'Therapist is not available on that date. Please choose another date.');
                      }
                    } catch (e) {
                      console.warn('Availability check error', e);
                    }
                  })();
                } else if (showTimePicker) {
                  // picked is a Date with time
                  setTime(formatTimeDisplay(picked));
                  // if we have a selected date object, update its time
                  setSelectedDateObj((prev) => {
                    const base = prev || new Date();
                    const newD = new Date(base);
                    newD.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
                    return newD;
                  });
                  setShowTimePicker(false);
                }
              }}
            />
          )}
          {/* web hidden inputs removed — using inline calendar and visible time input */}

          <Text style={styles.label}>Reason for appointment (optional)</Text>
          <TextInput
            placeholder="e.g., Anxiety, Depression, General Check-up"
            value={reason}
            onChangeText={setReason}
            style={[styles.input, styles.multilineInput]}
            placeholderTextColor="#aaa"
            multiline
          />

          <TouchableOpacity style={styles.bookButton} onPress={handleBook} disabled={loading}>
            <Text style={styles.bookButtonText}>{loading ? 'Booking…' : 'Book Session'}</Text>
          </TouchableOpacity>
          
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 18, paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 18 },
  emptyText: { fontSize: 16, color: '#666' },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  title: { fontSize: 18, fontWeight: '700', flex: 1 },
  listContent: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 40 },
  therapistOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  optionAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ddd', marginRight: 12 },
  optionInfo: { flex: 1 },
  optionName: { fontWeight: '700', marginBottom: 4, color: '#333' },
  optionRole: { color: '#666', fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  therapistCard: { alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#ddd', marginBottom: 8 },
  name: { fontWeight: '700', marginBottom: 4, fontSize: 16 },
  role: { color: '#666', fontSize: 12, marginBottom: 12 },
  changeButton: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#f0f0f0', borderRadius: 8 },
  changeButtonText: { color: '#0b61c6', fontWeight: '600', fontSize: 12 },
  label: { marginTop: 14, fontSize: 12, color: '#444', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 8, padding: 12, marginTop: 6, backgroundColor: '#f9f9f9' },
  multilineInput: { minHeight: 80, textAlignVertical: 'top' },
  bookButton: { marginTop: 20, backgroundColor: '#0b61c6', padding: 14, borderRadius: 8, alignItems: 'center' },
  bookButtonText: { color: '#fff', fontWeight: '700' },
  webCalendar: { marginTop: 8, borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 8, padding: 8, backgroundColor: '#fff' },
  webCalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  webCalMonth: { fontWeight: '700' },
  webCalNav: { fontSize: 18, paddingHorizontal: 8 },
  webCalGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  webCalDayHeader: { width: `${100/7}%`, textAlign: 'center', fontSize: 12, color: '#666', marginBottom: 6 },
  webCalCell: { width: `${100/7}%`, height: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  webCalCellText: { color: '#111' },
  webCalBooked: { backgroundColor: '#fee', borderRadius: 6 },
  webCalCellTextBooked: { color: '#a00' },
  webCalToday: { borderWidth: 1, borderColor: '#0b61c6', borderRadius: 6 },
  webCalPast: { opacity: 0.45 },
  webCalCellTextPast: { color: '#999' },
});
