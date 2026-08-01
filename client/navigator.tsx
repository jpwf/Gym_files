import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from './interfaces/home';
import CardiosScreen from './interfaces/cardios';
import TreinosScreen from './interfaces/treinos';
import RankingScreen from './interfaces/ranking';
import ProfileScreen from './interfaces/profile';

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
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

          if (route.name === 'Home') iconName = 'home-outline';
          else if (route.name === 'Cardios') iconName = 'fitness-outline';
          else if (route.name === 'Treinos') iconName = 'barbell-outline';
          else if (route.name === 'Ranking') iconName = 'podium-outline';
          else if (route.name === 'Perfil') iconName = 'person-outline';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Cardios" component={CardiosScreen} />
      <Tab.Screen name="Treinos" component={TreinosScreen} />
      <Tab.Screen name="Ranking" component={RankingScreen} />
      <Tab.Screen name="Perfil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}