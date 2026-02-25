import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet } from 'react-native';
import { NotificationFeed } from './TherapistDashboard';

export default function NotificationsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <NotificationFeed />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scroll: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 40,
  },
});
