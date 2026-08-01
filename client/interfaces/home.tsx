import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { DashboardData } from './types';

export default function HomeScreen() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await api.get<DashboardData>('/dashboard');
        setDashboardData(response.data);
      } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
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
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Olá, {dashboardData?.nome || 'Atleta'}!</Text>
          <Text style={styles.subtitle}>Confira o seu resumo semanal</Text>
        </View>

        <View style={styles.grid}>
          <View style={[styles.card, { backgroundColor: '#eff6ff' }]}>
            <Ionicons name="fitness-outline" size={28} color="#2563eb" />
            <Text style={styles.cardValue}>{dashboardData?.minutosCardio ?? 0} min</Text>
            <Text style={styles.cardLabel}>Cardio Semana</Text>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  containerCentered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  content: { padding: 20 },
  header: { marginBottom: 24 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  card: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center' },
  cardValue: { fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginVertical: 6 },
  cardLabel: { fontSize: 12, color: '#64748b' },
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
});