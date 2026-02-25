import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

const createScreen = (name) => {
  const Component = () => (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{name}</Text>
      </View>
    </SafeAreaView>
  );
  Component.displayName = name;
  return Component;
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: 'bold' },
});

export default createScreen('AdminTherapistManagement');
