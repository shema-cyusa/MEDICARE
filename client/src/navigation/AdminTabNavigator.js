import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import AdminDashboard from '../screens/AdminDashboard';
import AdminUserManagement from '../screens/AdminUserManagement';
import AdminAppointments from '../screens/AdminAppointments';
import AdminProfile from '../screens/AdminProfile';

const Tab = createBottomTabNavigator();

export default function AdminTabNavigator() {
  return (
    <Tab.Navigator screenOptions={{ headerShown: false }}>
      <Tab.Screen name="AdminHome" component={AdminDashboard} options={{ title: 'Home' }} />
      <Tab.Screen name="AdminUsers" component={AdminUserManagement} options={{ title: 'Users' }} />
      <Tab.Screen name="AdminAppointments" component={AdminAppointments} options={{ title: 'Appointments' }} />
      <Tab.Screen name="AdminProfile" component={AdminProfile} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}