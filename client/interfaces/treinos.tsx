import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, Modal } from 'react-native';
import { api } from '../services/api';

export default function TreinosScreen() {
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const muscleGroups = ['Peito', 'Tríceps', 'Costas', 'Bíceps', 'Ombros', 'Quadríceps', 'Posterior de perna', 'Abdomem'];

  const toggleMuscleGroup = (group: string) => {
    setSelectedMuscles((current) =>
      current.includes(group) ? current.filter((item) => item !== group) : [...current, group]
    );
  };

  const handleRegister = async () => {
    if (selectedMuscles.length === 0) {
      Alert.alert('Atenção', 'Selecione pelo menos um grupamento muscular.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/treinos', {
        tipo: selectedMuscles,
        data: new Date().toISOString(),
      });

      const groupsLabel = selectedMuscles.join(', ');
      setSuccessMessage(`Treino de ${groupsLabel} registrado!`);
      setShowSuccessModal(true);
      setSelectedMuscles([]);
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Não foi possível salvar o treino.';
      Alert.alert('Erro', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Registrar Treino</Text>

        <Text style={styles.label}>Grupamentos Musculares:</Text>
        <View style={styles.chipContainer}>
          {muscleGroups.map((group) => {
            const isSelected = selectedMuscles.includes(group);

            return (
              <TouchableOpacity
                key={group}
                style={[styles.chip, isSelected && styles.chipActive]}
                onPress={() => toggleMuscleGroup(group)}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                  {group}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={[styles.button, { backgroundColor: '#16a34a' }]} onPress={handleRegister} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Salvando...' : 'Salvar Treino'}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        transparent
        visible={showSuccessModal}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Registro concluído!</Text>
            <Text style={styles.modalText}>{successMessage}</Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 20 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#334155', marginBottom: 8, marginTop: 12 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
  },
  chipActive: { backgroundColor: '#16a34a' },
  chipText: { fontSize: 14, color: '#475569', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: 'bold' },
  button: { padding: 16, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
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
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 16,
    color: '#334155',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});