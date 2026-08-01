export interface DashboardData {
  nome: string;
  resumoTreinos: number;
  minutosCardio: number;
  posicaoRanking: number;
}

export interface RankingItem {
  posicao: number;
  user_id: string;
  username: string;
  treinos: number;
  minutos: number;
}

export interface RankingGeneral {
  ranking: RankingItem[];
}

export interface ProfileData {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  admin: boolean;
}
