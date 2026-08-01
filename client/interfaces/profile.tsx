import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, SafeAreaView, ActivityIndicator, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';
import { ProfileData } from './types';

type ProfileScreenProps = {
  navigation?: any;
};

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await api.get<ProfileData>('/profile-data');
        setUsername(response.data.username);
        setEmail(response.data.email);
      } catch (error) {
        console.error('Erro ao carregar perfil:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleUpdate = () => {
    Alert.alert('Sucesso', 'Perfil atualizado!');
  };

  const handleLogout = async () => {
    Alert.alert('Sair da Conta', 'Deseja mesmo encerrar a sessão?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sair',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('authToken');

          if (navigation?.getParent) {
            navigation.getParent()?.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          } else if (navigation?.reset) {
            navigation.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.containerCentered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Meu Perfil</Text>

        <Text style={styles.label}>Username:</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} />

        <Text style={styles.label}>E-mail:</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" />

        <View style={styles.actions}>
          <TouchableOpacity style={styles.button} onPress={handleUpdate}>
            <Text style={styles.buttonText}>Salvar Alterações</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  containerCentered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  actions: { marginTop: 24, width: '100%' },
  button: { backgroundColor: '#2563eb', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 0 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  logoutButton: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#ef4444' },
  logoutText: { color: '#ef4444', fontSize: 16, fontWeight: 'bold' },
});