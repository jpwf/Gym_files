import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

const mockUser = {
  name: 'João Pedro',
  rank: 12,
  weeklyWorkouts: 4,
  weeklyCardioMinutes: 180,
};

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Bem-vindo de volta</Text>
          <Text style={styles.userName}>{mockUser.name}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Resumo da semana</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{mockUser.weeklyWorkouts}</Text>
            <Text style={styles.statLabel}>treinos</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statValue}>{mockUser.weeklyCardioMinutes}</Text>
            <Text style={styles.statLabel}>min cardio</Text>
          </View>
        </View>

        <View style={styles.rankBox}>
          <Text style={styles.rankLabel}>Posição no rank geral</Text>
          <Text style={styles.rankValue}>#{mockUser.rank}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  header: {
    marginBottom: 24,
  },
  eyebrow: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 4,
  },
  userName: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
  },
  sectionTitle: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    color: '#94a3b8',
    marginTop: 6,
  },
  rankBox: {
    marginTop: 16,
    backgroundColor: '#1d4ed8',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  rankLabel: {
    color: '#dbeafe',
    fontSize: 14,
  },
  rankValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginTop: 6,
  },
});
