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

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');

    if (!token && config.url !== '/login') {
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
    if (error.response?.status === 401 || error.response?.status === 403) {
      await AsyncStorage.removeItem('authToken');
      navigateToLogin();
    }

    return Promise.reject(error);
  }
);