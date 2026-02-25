import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from './src/api';

import AuthContext from './src/context/AuthContext';
import Welcome from './src/screens/Welcome';
import Login from './src/screens/Login';
import Signup from './src/screens/Signup';
import ForgotPassword from './src/screens/ForgotPassword';
import LabLogin from './src/screens/LabLogin';
import LabTabNavigator from './src/navigation/LabTabNavigator';
import Dashboard from './src/screens/Dashboard';
import BookSession from './src/screens/BookSession';
import ChatThread from './src/screens/ChatThread';
import Messages from './src/screens/Messages';
import ResourceDetail from './src/screens/ResourceDetail';
import TherapistTabNavigator from './src/navigation/TherapistTabNavigator';

// Admin screens
import AdminDashboard from './src/screens/AdminDashboard';
import AdminUserManagement from './src/screens/AdminUserManagement';
import AdminAppointments from './src/screens/AdminAppointments';
import AdminAppointmentDetails from './src/screens/AdminAppointmentDetails';
import AdminUserDetails from './src/screens/AdminUserDetails';
import AdminTabNavigator from './src/navigation/AdminTabNavigator';
import AdminAppointmentEdit from './src/screens/AdminAppointmentEdit';

const Stack = createNativeStackNavigator();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userType, setUserType] = useState(null);
  const [user, setUser] = useState(null);

  const handleLogout = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      // Remove any admin header we set
      if (apiClient && apiClient.defaults && apiClient.defaults.headers && apiClient.defaults.headers.common) {
        delete apiClient.defaults.headers.common['x-user-id'];
      }
    } catch (error) {
      console.warn('Failed to clear auth token', error);
    } finally {
      setIsLoggedIn(false);
      setUserType(null);
      setUser(null);
    }
  }, [setIsLoggedIn, setUserType, setUser]);

  const handleLoginSuccess = useCallback((userData) => {
    setIsLoggedIn(true);
    setUserType(userData.user_type);
    setUser(userData);
    // If this user is an admin, include their user id on admin API calls
    if (userData && userData.user_type === 'admin') {
      apiClient.defaults.headers.common['x-user-id'] = userData.id;
    } else if (apiClient && apiClient.defaults && apiClient.defaults.headers && apiClient.defaults.headers.common) {
      delete apiClient.defaults.headers.common['x-user-id'];
    }
  }, [setIsLoggedIn, setUserType, setUser]);

  const authContextValue = useMemo(
    () => ({
      isLoggedIn,
      userType,
      user,
      setUser,
      logout: handleLogout,
    }),
    [isLoggedIn, userType, user, handleLogout, setUser],
  );

  useEffect(() => {
    const prepareApp = async () => {
      try {
        const authData = await AsyncStorage.getItem('authToken');
        if (authData) {
          const storedUser = JSON.parse(authData);
          setIsLoggedIn(true);
          setUserType(storedUser.user_type);
          setUser(storedUser);
          if (storedUser.user_type === 'admin') {
            apiClient.defaults.headers.common['x-user-id'] = storedUser.id;
          }
        }
      } catch (e) {
        console.error('App initialization error:', e);
      } finally {
        setIsReady(true);
      }
    };

    prepareApp();
  }, [setIsLoggedIn, setUserType, setUser, setIsReady]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
          }}
        >
          {!isLoggedIn ? (
            <>
              <Stack.Screen name="Welcome" component={Welcome} options={{ animationEnabled: false }} />
              <Stack.Screen name="Login">
                {(props) => (
                  <Login {...props} onLoginSuccess={handleLoginSuccess} />
                )}
              </Stack.Screen>
              <Stack.Screen name="LabLogin" component={LabLogin} options={{ title: 'Lab Login' }} />
              <Stack.Screen name="LabDashboard" component={LabTabNavigator} options={{ headerShown: false }} />
              <Stack.Screen name="Signup" component={Signup} />
              <Stack.Screen name="ForgotPassword" component={ForgotPassword} />
            </>
          ) : userType === 'therapist' ? (
            <Stack.Screen name="TherapistDashboard" component={TherapistTabNavigator} options={{ animationEnabled: false }} />
          ) : userType === 'admin' ? (
            <>
              <Stack.Screen name="Admin" component={AdminTabNavigator} options={{ headerShown: false, animationEnabled: false }} />
              <Stack.Screen name="AdminAppointmentDetails" component={AdminAppointmentDetails} />
              <Stack.Screen name="AdminUserDetails" component={AdminUserDetails} />
              <Stack.Screen name="AdminAppointmentEdit" component={AdminAppointmentEdit} />
            </>
          ) : (
            <>
              <Stack.Screen name="UserDashboard" component={Dashboard} options={{ animationEnabled: false }} />
              <Stack.Screen name="BookSession" component={BookSession} />
              <Stack.Screen name="Messages" component={Messages} />
              <Stack.Screen name="ChatThread" component={ChatThread} />
              <Stack.Screen name="ResourceDetail" component={ResourceDetail} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}
