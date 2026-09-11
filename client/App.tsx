import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './login';
import AppNavigator from './navigator';
import { navigationRef } from './navigation';

const Stack = createNativeStackNavigator();

type LoginRouteProps = {
  navigation: any;
};

function LoginRoute({ navigation }: LoginRouteProps) {
  return <LoginScreen navigation={navigation} onLoginSuccess={() => navigation.replace('Gym Files')} />;
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [initialRoute, setInitialRoute] = useState<'Login' | 'Gym Files'>('Login');

  useEffect(() => {
    async function checkAuth() {
      try {
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          setInitialRoute('Gym Files');
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login" component={LoginRoute} />
        <Stack.Screen name="Gym Files" component={AppNavigator} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});