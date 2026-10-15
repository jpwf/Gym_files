import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from './services/api';
import { ProfileData } from './interfaces/types';

import HomeScreen from './interfaces/home';
import CardiosScreen from './interfaces/cardios';
import TreinosScreen from './interfaces/treinos';
import RankingScreen from './interfaces/ranking';
import ProfileScreen from './interfaces/profile';
import RootUsersScreen from './interfaces/root-users';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(false);

  const loadProfile = async () => {
    setLoadingProfile(true);
    setProfileError(false);
    try {
      const response = await api.get<ProfileData>('/profile-data');
      setProfile(response.data);
    } catch (error) {
      console.error('Erro ao identificar o perfil da sessão:', error);
      setProfileError(true);
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.errorTitle}>Não foi possível validar seu acesso</Text>
        <Text style={styles.errorText}>As páginas ficaram bloqueadas até confirmar as permissões da conta.</Text>
        {profileError && (
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadProfile()}>
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    );
  }

  const isRoot = profile.is_root === true;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          height: 64,
          paddingBottom: 10,
          marginBottom: 2,
          paddingTop: 4,
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
        },
        tabBarIcon: ({ color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'help-outline';

          if (route.name === 'Usuários') iconName = 'people-outline';
          else if (route.name === 'Conta') iconName = 'person-outline';
          else if (route.name === 'Home') iconName = 'home-outline';
          else if (route.name === 'Cardios') iconName = 'fitness-outline';
          else if (route.name === 'Treinos') iconName = 'barbell-outline';
          else if (route.name === 'Ranking') iconName = 'podium-outline';
          else if (route.name === 'Perfil') iconName = 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      {isRoot ? (
        <>
          <Tab.Screen name="Usuários" component={RootUsersScreen} />
          <Tab.Screen name="Conta" component={ProfileScreen} />
        </>
      ) : (
        <>
          <Tab.Screen name="Home" component={HomeScreen} />
          <Tab.Screen name="Cardios" component={CardiosScreen} />
          <Tab.Screen name="Treinos" component={TreinosScreen} />
          <Tab.Screen name="Ranking" component={RankingScreen} />
          <Tab.Screen name="Perfil" component={ProfileScreen} />
        </>
      )}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  errorText: { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 8 },
  retryButton: { backgroundColor: '#2563eb', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 8, marginTop: 20 },
  retryButtonText: { color: '#fff', fontWeight: '700' },
});