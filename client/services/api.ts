import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigateToLogin } from '../navigation';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const publicAuthEndpoints = ['/login', '/auth/google'];

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    const isPublicAuthEndpoint = publicAuthEndpoints.includes(config.url || '');

    if (!token && !isPublicAuthEndpoint) {
      navigateToLogin();
      return Promise.reject(new Error('TOKEN_NAO_ENCONTRADO'));
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isPublicAuthEndpoint = publicAuthEndpoints.includes(error.config?.url || '');

    if (!isPublicAuthEndpoint && (error.response?.status === 401 || error.response?.status === 403)) {
      await AsyncStorage.removeItem('authToken');
      navigateToLogin();
    }

    return Promise.reject(error);
  }
);