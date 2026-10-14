import { api } from './api';

export interface CardioSuggestion {
  mensagem_motivacional: string;
  sugestoes_diarias: Array<{
    dia: string;
    minutos_sugeridos: number;
    motivo: string;
  }>;
}

export interface CardioSuggestionResponse {
  origem: 'cache' | 'sistema' | 'ia_gerado';
  dados: CardioSuggestion;
}

export type CardioSuggestionState =
  | { status: 'loading' }
  | { status: 'ready'; suggestion: CardioSuggestionResponse }
  | { status: 'error' };

const listeners = new Set<(state: CardioSuggestionState) => void>();

function publish(state: CardioSuggestionState) {
  listeners.forEach((listener) => listener(state));
}

export function subscribeToCardioSuggestions(listener: (state: CardioSuggestionState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function requestCardioSuggestion(metaSemanal: number) {
  publish({ status: 'loading' });

  try {
    const response = await api.post<CardioSuggestionResponse>('/cardio/sugestao', {
      meta_semanal: metaSemanal,
    });
    publish({ status: 'ready', suggestion: response.data });
    return response.data;
  } catch (error) {
    publish({ status: 'error' });
    throw error;
  }
}