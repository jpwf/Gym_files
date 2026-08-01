import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { api } from '../services/api';

export default function TreinosScreen() {
  const [workoutCount, setWorkoutCount] = useState('1');
  const [selectedMuscle, setSelectedMuscle] = useState('Peito / Tríceps');
  const [loading, setLoading] = useState(false);

  const muscleGroups = ['Peito / Tríceps', 'Costas / Bíceps', 'Pernas Completo', 'Ombros / Trapézio', 'Full Body'];

  const handleRegister = async () => {
    setLoading(true);

    try {
      await api.post('/treinos', {
        tipo: selectedMuscle,
        detalhes: `${workoutCount} treino(s) registrado(s)`,
        data: new Date().toISOString(),
      });

      Alert.alert('Sucesso!', `${workoutCount} treino de ${selectedMuscle} registrado!`);
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

        <Text style={styles.label}>Quantidade de Treinos no Dia:</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={workoutCount}
          onChangeText={setWorkoutCount}
        />

        <Text style={styles.label}>Grupamento Muscular:</Text>
        <View style={styles.chipContainer}>
          {muscleGroups.map((group) => (
            <TouchableOpacity
              key={group}
              style={[styles.chip, selectedMuscle === group && styles.chipActive]}
              onPress={() => setSelectedMuscle(group)}
            >
              <Text style={[styles.chipText, selectedMuscle === group && styles.chipTextActive]}>
                {group}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={[styles.button, { backgroundColor: '#16a34a' }]} onPress={handleRegister} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Salvando...' : 'Salvar Treino'}</Text>
        </TouchableOpacity>
      </View>
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
});