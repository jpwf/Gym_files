import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './login';
import AppDashboard from './App';

export default function App() {
  const [showLogin, setShowLogin] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('authToken');
      setIsAuthenticated(Boolean(token));
      setLoading(false);
    };

    checkAuth();

    const interval = setInterval(() => {
      spinValue.setValue(0);
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }, 3000);

    return () => clearInterval(interval);
  }, [spinValue]);

  if (loading) {
    return null;
  }

  if (isAuthenticated) {
    return <AppDashboard />;
  }

  if (showLogin) {
    return <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />;
  }

  const rotate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bem vindo ao Gym Files!</Text>

      <Pressable
        style={styles.button}
        onPress={() => setShowLogin(true)}
        accessibilityRole="button"
      >
        <Animated.View style={{ transform: [{ rotate }] }}>
          <MaterialIcons name="fitness-center" size={48} color="#fff" />
        </Animated.View>
      </Pressable>

      <Text style={styles.helperText}>Clique para prosseguir</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2563eb',
    width: 92,
    height: 92,
    borderRadius: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  helperText: {
    fontSize: 14,
    color: '#6b7280',
  },
});

