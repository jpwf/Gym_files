import axios from 'axios';

// Em desenvolvimento local PWA: 'http://localhost:3000'
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: Injeta automaticamente o Token JWT do Supabase/NestJS nas requisições
api.interceptors.request.use(
  async (config) => {
    // Exemplo: pegando o token salvo no localStorage (PWA Web) ou SecureStore (Nativo)
    const token = typeof window !== 'undefined' ? localStorage.getItem('@gymfiles:token') : null;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);