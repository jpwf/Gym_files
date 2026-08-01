import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { api } from '../services/api';

export default function CardiosScreen() {
  const [minutes, setMinutes] = useState('');
  const [selectedType, setSelectedType] = useState('Esteira');
  const [loading, setLoading] = useState(false);

  const cardioTypes = ['Esteira', 'Corrida Rua', 'Bicicleta', 'Escada', 'Natação'];

  const handleRegister = async () => {
    if (!minutes) {
      Alert.alert('Atenção', 'Informe a quantidade de minutos.');
      return;
    }

    setLoading(true);

    try {
      await api.post('/cardios', {
        tipo: selectedType,
        duracao_min: Number(minutes),
        data: new Date().toISOString(),
      });

      Alert.alert('Sucesso!', `${minutes} min de ${selectedType} registrados!`);
      setMinutes('');
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Não foi possível salvar o cardio.';
      Alert.alert('Erro', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Registrar Cardio</Text>

        <Text style={styles.label}>Duração (em minutos):</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex: 45"
          keyboardType="numeric"
          value={minutes}
          onChangeText={setMinutes}
        />

        <Text style={styles.label}>Tipo de Cardio:</Text>
        <View style={styles.chipContainer}>
          {cardioTypes.map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.chip, selectedType === type && styles.chipActive]}
              onPress={() => setSelectedType(type)}
            >
              <Text style={[styles.chipText, selectedType === type && styles.chipTextActive]}>
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Salvando...' : 'Salvar Cardio'}</Text>
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
  chipActive: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 14, color: '#475569', fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: 'bold' },
  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});