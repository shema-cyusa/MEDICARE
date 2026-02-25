import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import LabHome from '../screens/LabHome';
import LabNotifications from '../screens/LabNotifications';
import LabAssignments from '../screens/LabAssignments';
import LabProfile from '../screens/LabProfile';

const Tab = createBottomTabNavigator();

export default function LabTabNavigator({ route }) {
  const { labId, labName, labEmail, token } = route.params || {};

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'LabHome') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'LabNotifications') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          } else if (route.name === 'LabAssignments') {
            iconName = focused ? 'list' : 'list-outline';
          } else if (route.name === 'LabProfile') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4A90E2',
        tabBarInactiveTintColor: 'gray',
        headerShown: true,
      })}
    >
      <Tab.Screen
        name="LabHome"
        component={LabHome}
        options={{ title: 'Dashboard' }}
        initialParams={{ labId, labName, labEmail, token }}
      />
      <Tab.Screen
        name="LabNotifications"
        component={LabNotifications}
        options={{ title: 'Notifications' }}
        initialParams={{ labId, labName, labEmail, token }}
      />
      <Tab.Screen
        name="LabAssignments"
        component={LabAssignments}
        options={{ title: 'Assignments' }}
        initialParams={{ labId, labName, labEmail, token }}
      />
      <Tab.Screen
        name="LabProfile"
        component={LabProfile}
        options={{ title: 'Profile' }}
        initialParams={{ labId, labName, labEmail, token }}
      />
    </Tab.Navigator>
  );
}
