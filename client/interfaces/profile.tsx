import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  SafeAreaView, 
  ActivityIndicator, 
  ScrollView,
  Modal 
} from 'react-native';
import { api } from '../services/api';
import { ProfileData } from './types';

type ProfileScreenProps = {
  navigation?: any;
  onLogout?: () => void; // Prop opcional de callback para notificar o App.tsx
};

export default function ProfileScreen({ navigation, onLogout }: ProfileScreenProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  // Estados para controlar o Modal de Logout
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

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

  // 1. Abre o modal de confirmação
  const handleLogoutPress = () => {
    setShowLogoutModal(true);
  };

  // 2. Limpa a autenticação, aguarda 2s no modal e dispara a alteração de estado para o App.tsx
  const confirmLogout = () => {
    // Limpa o token do localStorage
    localStorage.removeItem('authToken');
    setIsLoggingOut(true);

    // Delay de 2 segundos antes de desmontar o perfil/voltar pro App.tsx
    setTimeout(() => {
      setShowLogoutModal(false);
      setIsLoggingOut(false);

      if (onLogout) {
        onLogout(); // Notifica o App.tsx para trocar a tela
      } else if (navigation?.navigate) {
        navigation.navigate('Login'); // Se usar navegação por props customizada
      } else {
        window.location.reload(); // Fallback caso queira forçar o reset do estado global
      }
    }, 2000);
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

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogoutPress}>
            <Text style={styles.logoutText}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* MODAL DE LOGOUT CUSTOMIZADO */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !isLoggingOut && setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {isLoggingOut ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="small" color="#ef4444" style={{ marginBottom: 12 }} />
                <Text style={styles.modalTitle}>Sessão encerrada!</Text>
                <Text style={styles.modalSubtext}>Redirecionando para a tela inicial...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.modalTitle}>Sair da Conta</Text>
                <Text style={styles.modalSubtext}>Deseja mesmo encerrar sua sessão?</Text>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalCancelButton}
                    onPress={() => setShowLogoutModal(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalConfirmButton}
                    onPress={confirmLogout}
                  >
                    <Text style={styles.modalConfirmText}>Sim, Sair</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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

  /* Estilos do Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  modalSubtext: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 14,
  },
  modalConfirmButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  modalLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
});