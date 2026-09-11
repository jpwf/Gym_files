export interface DashboardData {
  nome: string;
  resumoTreinos: number;
  minutosCardio: number;
  minutosFaltantesCardio?: number;
  metaCardioMinutos?: number;
  pontosCardio?: number;
  posicaoRanking: number;
  admin?: boolean;
}

export interface TrainerAthleteSummary {
  user_id: string;
  username: string;
  email: string;
  treinos: number;
  minutos: number;
  meta_minutos: number;
  faltando_minutos: number;
}

export interface TrainerAthleteDetail {
  user_id: string;
  username: string;
  email: string;
  metaMinutos: number;
  minutosSemana: number;
  minutosFaltantes: number;
  treinoMaisRecente?: {
    data: string;
    grupos: string;
  } | null;
  cardioMaisRecente?: {
    tipo: string;
    duracao_min: number;
    data: string;
    foto_url?: string | null;
  } | null;
}

export interface RankingItem {
  posicao: number;
  user_id: string;
  username: string;
  treinos: number;
  minutos: number;
  pontos?: number;
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
