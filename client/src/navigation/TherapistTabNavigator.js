import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import TherapistDashboard from '../screens/TherapistDashboard';
import CommunityCreate from '../screens/CommunityCreate';
import Messages from '../screens/Messages';
import Resources from '../screens/Resources';
import TherapistResources from '../screens/TherapistResources';
import Profile from '../screens/Profile';
import AggregatedAssessments from '../screens/AggregatedAssessments';
import AssessmentCreate from '../screens/AssessmentCreate';
import AssessmentResults from '../screens/AssessmentResults';
import NotificationsScreen from '../screens/Notifications';
import AppointmentDetails from '../screens/AppointmentDetails';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const DashboardStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: true }}>
    <Stack.Screen
      name="TherapistDashboardScreen"
      component={TherapistDashboard}
      options={{ title: 'Dashboard' }}
    />
  </Stack.Navigator>
);

const NotificationsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: true }}>
    <Stack.Screen
      name="NotificationsScreen"
      component={NotificationsScreen}
      options={{ title: 'Notifications' }}
    />
    <Stack.Screen
      name="AssessmentResultsScreen"
      component={AssessmentResults}
      options={{ title: 'Diagnosis Results' }}
    />
    <Stack.Screen
      name="AppointmentDetails"
      component={AppointmentDetails}
      options={{ title: 'Appointment Details' }}
    />
  </Stack.Navigator>
);

const MessagesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: true }}>
    <Stack.Screen
      name="MessagesScreen"
      component={Messages}
      options={{ title: 'Messages' }}
    />
    <Stack.Screen
      name="ChatThread"
      component={require('../screens/ChatThread').default}
      options={{ title: 'Chat' }}
    />
  </Stack.Navigator>
);

const AssessmentsStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: true }}>
    <Stack.Screen
      name="AggregatedAssessmentsScreen"
      component={AggregatedAssessments}
      options={{ title: 'Diagnoses' }}
    />
    <Stack.Screen
      name="AssessmentCreateScreen"
      component={AssessmentCreate}
      options={{ title: 'Create Diagnosis' }}
    />
    <Stack.Screen
      name="AssessmentResultsScreen"
      component={AssessmentResults}
      options={{ title: 'Diagnosis Results' }}
    />
  </Stack.Navigator>
);

const ResourcesStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: true }}>
    <Stack.Screen
      name="TherapistResourcesScreen"
      component={TherapistResources}
      options={{ title: 'Create & Manage Resources' }}
    />
  </Stack.Navigator>
);

const ProfileStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: true }}>
    <Stack.Screen
      name="ProfileScreen"
      component={Profile}
      options={{ title: 'Profile' }}
    />
  </Stack.Navigator>
);

export default function TherapistTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Notifications') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'mail' : 'mail-outline';
          } else if (route.name === 'Assessments') {
            iconName = focused ? 'clipboard' : 'clipboard-outline';
          } else if (route.name === 'Resources') {
            iconName = focused ? 'book' : 'book-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Notifications" component={NotificationsStack} options={{ title: 'Notifications' }} />
      <Tab.Screen
        name="CommunityCreate"
        component={CommunityCreate}
        options={{
          title: 'Create',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen name="Messages" component={MessagesStack} options={{ title: 'Messages' }} />
      <Tab.Screen name="Assessments" component={AssessmentsStack} options={{ title: 'Diagnosis' }} />
      <Tab.Screen name="Resources" component={ResourcesStack} options={{ title: 'Resources' }} />
      <Tab.Screen name="Profile" component={ProfileStack} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
