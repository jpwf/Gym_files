import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { DashboardData, TrainerAthleteDetail, TrainerAthleteSummary } from './types';

export default function HomeScreen() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [athletes, setAthletes] = useState<TrainerAthleteSummary[]>([]);
  const [selectedAthlete, setSelectedAthlete] = useState<TrainerAthleteDetail | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [metaInput, setMetaInput] = useState('');
  const [viewMode, setViewMode] = useState<'athlete' | 'trainer'>('athlete');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAthletes, setLoadingAthletes] = useState(false);
  const [loadingAthleteModal, setLoadingAthleteModal] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  const loadDashboard = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await api.get<DashboardData>('/dashboard');
      setDashboardData(response.data);
      setViewMode(response.data?.admin === true ? viewMode : 'athlete');
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  };

  const loadAthletes = async () => {
    setLoadingAthletes(true);
    try {
      const response = await api.get<TrainerAthleteSummary[]>('/trainer-athletes');
      setAthletes(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar atletas:', error);
    } finally {
      setLoadingAthletes(false);
    }
  };

  const openAthleteModal = async (athleteId: string) => {
    setLoadingAthleteModal(true);
    try {
      const response = await api.get<TrainerAthleteDetail>(`/trainer-athletes/${athleteId}`);
      setSelectedAthlete(response.data);
      setMetaInput(String(response.data.metaMinutos ?? 0));
    } catch (error) {
      console.error('Erro ao carregar detalhe do atleta:', error);
      Alert.alert('Erro', 'Não foi possível carregar o atleta.');
    } finally {
      setLoadingAthleteModal(false);
    }
  };

  const saveMeta = async () => {
    if (!selectedAthlete) return;

    const value = Number(metaInput);
    if (!Number.isFinite(value) || value < 0) {
      Alert.alert('Meta inválida', 'Informe um valor de minutos válido.');
      return;
    }

    setSavingMeta(true);
    try {
      await api.post(`/athletes/${selectedAthlete.user_id}/meta-cardio`, {
        meta_minutos: value,
      });

      Alert.alert('Sucesso', 'Meta de cardio atualizada.');
      await loadAthletes();
      await openAthleteModal(selectedAthlete.user_id);
      await loadDashboard(true);
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Não foi possível salvar a meta.';
      Alert.alert('Erro', message);
    } finally {
      setSavingMeta(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (dashboardData?.admin === true && viewMode === 'trainer') {
      loadAthletes();
    }
  }, [dashboardData?.admin, viewMode]);

  if (loading) {
    return (
      <SafeAreaView style={styles.containerCentered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  const canShowTrainerView = dashboardData?.admin === true;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerText}>
              <Text style={styles.greeting}>Olá, {dashboardData?.nome || 'Atleta'}!</Text>
              <Text style={styles.subtitle}>Confira o seu resumo semanal</Text>
            </View>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={() => loadDashboard(true)}
              disabled={refreshing}
              activeOpacity={0.8}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <Ionicons name="refresh-outline" size={20} color="#2563eb" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {canShowTrainerView && (
          <View style={styles.switchContainer}>
            <TouchableOpacity
              style={[styles.switchButton, viewMode === 'athlete' && styles.switchButtonActive]}
              onPress={() => setViewMode('athlete')}
            >
              <Text style={[styles.switchText, viewMode === 'athlete' && styles.switchTextActive]}>Atleta</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.switchButton, viewMode === 'trainer' && styles.switchButtonActive]}
              onPress={() => setViewMode('trainer')}
            >
              <Text style={[styles.switchText, viewMode === 'trainer' && styles.switchTextActive]}>Treinador</Text>
            </TouchableOpacity>
          </View>
        )}

        {viewMode === 'athlete' ? (
          <>
            <View style={styles.grid}>
              <View style={[styles.card, { backgroundColor: '#eff6ff' }]}>
                <Ionicons name="fitness-outline" size={28} color="#2563eb" />
                <Text style={styles.cardValue}>{dashboardData?.minutosCardio ?? 0} min</Text>
                <Text style={styles.cardLabel}>Cardio Semana</Text>
                {typeof dashboardData?.metaCardioMinutos === 'number' && (
                  <Text style={styles.missingText}>
                    {dashboardData.minutosFaltantesCardio ?? 0} min faltando
                  </Text>
                )}
              </View>

              <View style={[styles.card, { backgroundColor: '#f0fdf4' }]}>
                <Ionicons name="barbell-outline" size={28} color="#16a34a" />
                <Text style={styles.cardValue}>{dashboardData?.resumoTreinos ?? 0}</Text>
                <Text style={styles.cardLabel}>Treinos Realizados</Text>
              </View>
            </View>

            <View style={styles.rankingCard}>
              <View style={styles.rankingHeader}>
                <Ionicons name="trophy" size={28} color="#eab308" />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.rankingTitle}>Sua Posição no Ranking</Text>
                  <Text style={styles.rankingSub}>Você está na semana atual!</Text>
                </View>
              </View>
              <Text style={styles.rankBadge}>#{dashboardData?.posicaoRanking ?? 0}º Lugar</Text>
            </View>
          </>
        ) : (
          <View style={styles.trainerPanel}>
            <Text style={styles.sectionTitle}>Atletas da plataforma</Text>
            {loadingAthletes ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : athletes.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum atleta encontrado.</Text>
            ) : (
              athletes.map((athlete) => (
                <TouchableOpacity
                  key={athlete.user_id}
                  style={[styles.athleteItem, loadingAthleteModal && styles.athleteItemDisabled]}
                  onPress={() => openAthleteModal(athlete.user_id)}
                  disabled={loadingAthleteModal}
                  activeOpacity={0.8}
                >
                  <View style={styles.athleteInfo}>
                    <Text style={styles.athleteName}>{athlete.username || 'Atleta'}</Text>
                    <Text style={styles.athleteMeta}>Treinos: {athlete.treinos} • Minutos: {athlete.minutos}</Text>
                  </View>
                  <View style={styles.athleteMetaRight}>
                    {loadingAthleteModal ? (
                      <ActivityIndicator size="small" color="#2563eb" />
                    ) : (
                      <Text style={styles.athleteMissing}>{athlete.faltando_minutos} min faltando</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>

      <Modal transparent visible={!!selectedAthlete || loadingAthleteModal} animationType="slide" onRequestClose={() => setSelectedAthlete(null)}>
        <View style={styles.modalOverlay}>
          {loadingAthleteModal ? (
            <View style={styles.modalLoadingContent}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.loadingText}>Carregando atleta...</Text>
            </View>
          ) : (
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedAthlete?.username || 'Atleta'}</Text>
                <TouchableOpacity onPress={() => setSelectedAthlete(null)}>
                  <Ionicons name="close" size={24} color="#334155" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalSectionLabel}>Treino mais recente</Text>
            <Text style={styles.modalValue}>
              {selectedAthlete?.treinoMaisRecente
                ? `${new Date(selectedAthlete.treinoMaisRecente.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} • ${selectedAthlete.treinoMaisRecente.grupos}`
                : 'Nenhum treino registrado'}
            </Text>

            <Text style={styles.modalSectionLabel}>Cardio mais recente</Text>
            <View style={styles.cardioRow}>
              <Text style={styles.modalValue}>
                {selectedAthlete?.cardioMaisRecente
                  ? `${selectedAthlete.cardioMaisRecente.duracao_min} min • ${new Date(selectedAthlete.cardioMaisRecente.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
                  : 'Nenhum cardio registrado'}
              </Text>
              {selectedAthlete?.cardioMaisRecente?.foto_url && (
                <TouchableOpacity onPress={() => setSelectedImage(selectedAthlete.cardioMaisRecente?.foto_url ?? null)}>
                  <Ionicons name="eye-outline" size={22} color="#2563eb" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.modalSectionLabel}>Meta de cardio semanal</Text>
            <View style={styles.metaRow}>
              <TextInput
                style={styles.input}
                placeholder="Minutos"
                keyboardType="numeric"
                value={metaInput}
                onChangeText={setMetaInput}
              />
              <TouchableOpacity style={styles.metaButton} onPress={saveMeta} disabled={savingMeta}>
                <Text style={styles.metaButtonText}>{savingMeta ? 'Salvando...' : 'Salvar'}</Text>
              </TouchableOpacity>
            </View>

              <Text style={styles.metaSummary}>
                Atual: {selectedAthlete?.minutosSemana ?? 0} min • Meta: {selectedAthlete?.metaMinutos ?? 0} min • Faltando: {selectedAthlete?.minutosFaltantes ?? 0} min
              </Text>
            </View>
          )}
        </View>
      </Modal>

      <Modal transparent visible={!!selectedImage} animationType="fade" onRequestClose={() => setSelectedImage(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.imageModalContent}>
            <TouchableOpacity style={styles.closeImageButton} onPress={() => setSelectedImage(null)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            {selectedImage && <Image source={{ uri: selectedImage }} style={styles.previewImage} />}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  containerCentered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  content: { padding: 20 },
  header: { marginBottom: 24 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flex: 1, marginRight: 12 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  refreshButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchContainer: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: '#f1f5f9',
    borderRadius: 999,
    padding: 4,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  switchButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  switchText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 12,
  },
  switchTextActive: {
    color: '#0f172a',
  },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  card: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center' },
  cardValue: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginVertical: 6 },
  cardLabel: { fontSize: 12, color: '#64748b' },
  missingText: { marginTop: 4, fontSize: 11, color: '#dc2626', fontWeight: '600' },
  rankingCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  rankingHeader: { flexDirection: 'row', alignItems: 'center' },
  rankingTitle: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' },
  rankingSub: { fontSize: 12, color: '#64748b' },
  rankBadge: { fontSize: 20, fontWeight: 'bold', color: '#eab308' },
  trainerPanel: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  athleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  athleteItemDisabled: {
    opacity: 0.7,
  },
  athleteInfo: {
    flex: 1,
    marginRight: 12,
  },
  athleteMetaRight: {
    minWidth: 94,
    alignItems: 'flex-end',
  },
  athleteName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  athleteMeta: { color: '#64748b', marginTop: 2, fontSize: 12 },
  athleteMissing: { color: '#dc2626', fontSize: 12, fontWeight: '700' },
  emptyText: { color: '#64748b', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalLoadingContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%',
  },
  loadingText: {
    marginTop: 12,
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '600',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  modalSectionLabel: { fontSize: 13, color: '#64748b', marginTop: 12, marginBottom: 4, fontWeight: '600' },
  modalValue: { color: '#0f172a', fontSize: 15 },
  cardioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    padding: 12,
  },
  metaButton: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaButtonText: { color: '#fff', fontWeight: '700' },
  metaSummary: { marginTop: 12, color: '#475569', fontSize: 12 },
  imageModalContent: {
    width: '88%',
    maxWidth: 420,
    backgroundColor: '#0f172a',
    borderRadius: 18,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 420,
    borderRadius: 12,
    resizeMode: 'contain',
    backgroundColor: '#020817',
  },
  closeImageButton: {
    alignSelf: 'flex-end',
    marginBottom: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});