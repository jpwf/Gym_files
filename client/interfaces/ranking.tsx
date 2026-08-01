import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ActivityIndicator, FlatList } from 'react-native';
import { api } from '../services/api';
import { RankingGeneral } from './types';

export default function RankingScreen() {
  const [ranking, setRanking] = useState<RankingGeneral | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRanking = async () => {
      try {
        const response = await api.get<RankingGeneral | { ranking: RankingGeneral['ranking'] }>('/ranking');
        const payload = Array.isArray(response.data)
          ? { ranking: response.data }
          : response.data;

        setRanking(payload);
      } catch (error) {
        console.error('Erro ao carregar ranking:', error);
      } finally {
        setLoading(false);
      }
    };

    loadRanking();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.containerCentered}>
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ranking Geral</Text>
        <Text style={styles.subtitle}>Resumo semanal da comunidade</Text>
      </View>

      <FlatList
        data={ranking?.ranking ?? []}
        keyExtractor={(item) => `${item.user_id}-${item.posicao}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.position}>#{item.posicao}</Text>
            <View style={styles.userInfo}>
              <Text style={styles.username}>{item.username}</Text>
              <Text style={styles.meta}>{item.treinos} treinos • {item.minutos} min</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  containerCentered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
  },
  position: { fontSize: 16, fontWeight: '700', color: '#2563eb', width: 44 },
  userInfo: { flex: 1 },
  username: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  meta: { fontSize: 12, color: '#64748b', marginTop: 2 },
});
