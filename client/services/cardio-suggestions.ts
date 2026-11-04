import { api } from './api';
import { getAuthToken } from './auth-storage';

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
const inFlightRequests = new Map<
  string,
  { forceRefresh: boolean; promise: Promise<CardioSuggestionResponse>; token: object }
>();

function publish(state: CardioSuggestionState) {
  listeners.forEach((listener) => listener(state));
}

export function subscribeToCardioSuggestions(listener: (state: CardioSuggestionState) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function requestCardioSuggestion(
  metaSemanal: number,
  forceRefresh = false
): Promise<CardioSuggestionResponse> {
  const authToken = await getAuthToken();
  const requestKey = `${authToken ?? 'no-token'}:${metaSemanal}`;
  const inFlight = inFlightRequests.get(requestKey);
  if (inFlight) {
    if (!forceRefresh || inFlight.forceRefresh) {
      return inFlight.promise;
    }

    return inFlight.promise
      .catch(() => undefined)
      .then(() => requestCardioSuggestion(metaSemanal, true));
  }

  publish({ status: 'loading' });

  const token = {};
  const promise = api.post<CardioSuggestionResponse>('/cardio/sugestao', {
    meta_semanal: metaSemanal,
    atualizar: forceRefresh,
  })
    .then((response) => {
      publish({ status: 'ready', suggestion: response.data });
      return response.data;
    })
    .catch((error) => {
      publish({ status: 'error' });
      throw error;
    })
    .finally(() => {
      if (inFlightRequests.get(requestKey)?.token === token) {
        inFlightRequests.delete(requestKey);
      }
    });

  inFlightRequests.set(requestKey, { forceRefresh, promise, token });
  return promise;
}