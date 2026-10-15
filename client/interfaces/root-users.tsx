import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from '../services/api';
import { ProfileData } from './types';

type ManagedUser = {
  id: string;
  username: string | null;
  email: string;
  is_admin: boolean;
  is_root: boolean;
  createdAt: string | null;
};

type UserForm = {
  username: string;
  email: string;
  password: string;
  is_admin: boolean;
};

const emptyForm: UserForm = {
  username: '',
  email: '',
  password: '',
  is_admin: false,
};

export default function RootUsersScreen() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadUsers = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');

    try {
      const [usersResponse, profileResponse] = await Promise.all([
        api.get<ManagedUser[]>('/root/users'),
        api.get<ProfileData>('/profile-data'),
      ]);
      setUsers(usersResponse.data);
      setCurrentUserId(profileResponse.data.id);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || 'Não foi possível carregar os usuários.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const createUser = async () => {
    setError('');
    setNotice('');
    setSaving(true);

    try {
      await api.post('/root/users', {
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        is_admin: form.is_admin,
      });
      setForm(emptyForm);
      setShowCreateModal(false);
      setNotice('Usuário criado.');
      await loadUsers(false);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || 'Não foi possível criar o usuário.');
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async () => {
    if (!pendingRemoval) return;

    setDeleting(true);
    setError('');
    setNotice('');

    try {
      await api.delete(`/root/users/${pendingRemoval.id}`);
      setPendingRemoval(null);
      setNotice('Usuário removido.');
      await loadUsers(false);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || 'Não foi possível remover o usuário.');
    } finally {
      setDeleting(false);
    }
  };

  const openCreateModal = () => {
    setForm(emptyForm);
    setError('');
    setNotice('');
    setShowCreateModal(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Gestão de usuários</Text>
            <Text style={styles.subtitle}>Contas e permissões do Gym Files</Text>
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => {
              setRefreshing(true);
              void loadUsers(false);
            }}
            disabled={refreshing || loading}
            accessibilityRole="button"
            accessibilityLabel="Atualizar lista de usuários"
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <Ionicons name="refresh-outline" size={21} color="#2563eb" />
            )}
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorMessage}>{error}</Text> : null}
        {notice ? <Text style={styles.noticeMessage}>{notice}</Text> : null}

        <TouchableOpacity style={styles.createButton} onPress={openCreateModal}>
          <Ionicons name="person-add-outline" size={19} color="#fff" />
          <Text style={styles.createButtonText}>Adicionar usuário</Text>
        </TouchableOpacity>

        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Contas</Text>
          <Text style={styles.count}>{users.length}</Text>
        </View>

        {loading ? (
          <ActivityIndicator style={styles.listLoader} size="large" color="#2563eb" />
        ) : users.length === 0 ? (
          <Text style={styles.emptyText}>Nenhum usuário cadastrado.</Text>
        ) : (
          <View style={styles.userList}>
            {users.map((user) => {
              const protectedAccount = user.is_root || user.id === currentUserId;
              return (
                <View key={user.id} style={styles.userRow}>
                  <View style={styles.userInfo}>
                    <View style={styles.nameLine}>
                      <Text style={styles.userName}>{user.username || 'Sem nome'}</Text>
                      {user.is_root ? <Text style={styles.rootBadge}>ROOT</Text> : null}
                    </View>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    <Text style={styles.roleText}>
                      {user.is_admin ? 'Administrador' : 'Atleta'}
                      {user.createdAt ? ` · ${new Date(user.createdAt).toLocaleDateString('pt-BR')}` : ''}
                    </Text>
                  </View>
                  {protectedAccount ? (
                    <Ionicons name="lock-closed-outline" size={19} color="#94a3b8" />
                  ) : (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => setPendingRemoval(user)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remover ${user.username || user.email}`}
                    >
                      <Ionicons name="trash-outline" size={19} color="#b42318" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        transparent
        visible={showCreateModal}
        animationType="slide"
        onRequestClose={() => !saving && setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo usuário</Text>
              <TouchableOpacity onPress={() => !saving && setShowCreateModal(false)} disabled={saving}>
                <Ionicons name="close" size={24} color="#475569" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Nome de usuário</Text>
            <TextInput
              style={styles.input}
              value={form.username}
              onChangeText={(username) => setForm((current) => ({ ...current, username }))}
              autoCapitalize="none"
              maxLength={80}
              editable={!saving}
            />

            <Text style={styles.label}>E-mail</Text>
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(email) => setForm((current) => ({ ...current, email }))}
              autoCapitalize="none"
              keyboardType="email-address"
              maxLength={254}
              editable={!saving}
            />

            <Text style={styles.label}>Senha inicial</Text>
            <TextInput
              style={styles.input}
              value={form.password}
              onChangeText={(password) => setForm((current) => ({ ...current, password }))}
              secureTextEntry
              autoCapitalize="none"
              editable={!saving}
            />
            <Text style={styles.hint}>Mínimo de 8 caracteres.</Text>

            <View style={styles.permissionRow}>
              <View style={styles.permissionText}>
                <Text style={styles.label}>Administrador</Text>
                <Text style={styles.hint}>Acesso às funções administrativas existentes.</Text>
              </View>
              <Switch
                value={form.is_admin}
                onValueChange={(is_admin) => setForm((current) => ({ ...current, is_admin }))}
                disabled={saving}
                trackColor={{ false: '#cbd5e1', true: '#93c5fd' }}
                thumbColor={form.is_admin ? '#2563eb' : '#f8fafc'}
              />
            </View>

            {error ? <Text style={styles.errorMessage}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.createButton, saving && styles.disabledButton]}
              onPress={() => void createUser()}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark" size={19} color="#fff" />}
              <Text style={styles.createButtonText}>{saving ? 'Criando...' : 'Criar usuário'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={!!pendingRemoval}
        animationType="fade"
        onRequestClose={() => !deleting && setPendingRemoval(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmContent}>
            <Text style={styles.modalTitle}>Remover usuário?</Text>
            <Text style={styles.confirmText}>
              {pendingRemoval?.username || pendingRemoval?.email} perderá o acesso. Os registros vinculados também serão removidos.
            </Text>
            {error ? <Text style={styles.errorMessage}>{error}</Text> : null}
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setPendingRemoval(null)}
                disabled={deleting}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.removeConfirmButton, deleting && styles.disabledButton]}
                onPress={() => void removeUser()}
                disabled={deleting}
              >
                {deleting ? <ActivityIndicator size="small" color="#fff" /> : null}
                <Text style={styles.removeConfirmText}>{deleting ? 'Removendo...' : 'Remover'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerText: { flex: 1, marginRight: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  iconButton: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' },
  createButton: { minHeight: 48, borderRadius: 8, backgroundColor: '#2563eb', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 14 },
  createButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  listHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26, marginBottom: 8 },
  sectionTitle: { color: '#0f172a', fontWeight: '700', fontSize: 17 },
  count: { color: '#475569', fontSize: 13 },
  listLoader: { marginTop: 32 },
  emptyText: { color: '#64748b', fontSize: 14, paddingVertical: 20 },
  userList: { borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  userRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingVertical: 14 },
  userInfo: { flex: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  userName: { color: '#0f172a', fontSize: 15, fontWeight: '700' },
  userEmail: { color: '#334155', fontSize: 13, marginTop: 3 },
  roleText: { color: '#64748b', fontSize: 12, marginTop: 4 },
  rootBadge: { color: '#854d0e', backgroundColor: '#fef3c7', fontSize: 10, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  deleteButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#fef3f2' },
  errorMessage: { color: '#b42318', backgroundColor: '#fef3f2', borderWidth: 1, borderColor: '#fecdca', borderRadius: 8, padding: 10, marginTop: 12, fontSize: 13 },
  noticeMessage: { color: '#166534', backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'center', alignItems: 'center', padding: 18 },
  modalContent: { width: '100%', maxWidth: 460, maxHeight: '92%', backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { color: '#0f172a', fontSize: 19, fontWeight: '700' },
  label: { color: '#334155', fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, color: '#0f172a', backgroundColor: '#fff' },
  hint: { color: '#64748b', fontSize: 12, marginTop: 4 },
  permissionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8, marginBottom: 16 },
  permissionText: { flex: 1 },
  disabledButton: { opacity: 0.65 },
  confirmContent: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 12, padding: 22 },
  confirmText: { color: '#475569', fontSize: 14, lineHeight: 20, marginTop: 10 },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 22 },
  cancelButton: { minHeight: 44, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#cbd5e1' },
  cancelButtonText: { color: '#334155', fontWeight: '600' },
  removeConfirmButton: { minHeight: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, backgroundColor: '#b42318' },
  removeConfirmText: { color: '#fff', fontWeight: '700' },
});
