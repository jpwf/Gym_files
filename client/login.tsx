import React, { useState, useCallback } from 'react';
import { FontAwesome } from '@expo/vector-icons';
import { makeRedirectUri, ResponseType, useAuthRequest } from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api } from './services/api';
import { setAuthToken } from './services/auth-storage';

WebBrowser.maybeCompleteAuthSession();

const NONCE_KEY = 'google_oauth_nonce';

async function saveNonce(nonce: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(NONCE_KEY, nonce);
    return;
  }

  await SecureStore.setItemAsync(NONCE_KEY, nonce);
}

async function getNonce() {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(NONCE_KEY);
  }

  return SecureStore.getItemAsync(NONCE_KEY);
}

async function clearNonce() {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(NONCE_KEY);
    return;
  }

  await SecureStore.deleteItemAsync(NONCE_KEY);
}

type LoginScreenProps = {
  navigation?: any;
  onLoginSuccess?: () => void;
};

export default function LoginScreen({ navigation, onLoginSuccess }: LoginScreenProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const googleClientId = Platform.select({
    ios: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    android: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    default: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });
  const redirectUri = makeRedirectUri({ scheme: 'gymfiles' });

  // Gera nonce fresco a cada tentativa de login
  const generateNonce = useCallback(async () => {
    const nonce = Crypto.randomUUID();
    await saveNonce(nonce);
    return nonce;
  }, []);

  const [googleRequest, , promptGoogleLogin] = useAuthRequest(
    {
      clientId: googleClientId || '',
      redirectUri,
      responseType: ResponseType.IdToken,
      scopes: ['openid', 'profile', 'email'],
      usePKCE: true,
      extraParams: { prompt: 'select_account' }, // nonce será adicionado dinamicamente
    },
    { authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth' }
  );

  async function completeLogin(token: string) {
    await setAuthToken(token);

    if (onLoginSuccess) {
      onLoginSuccess();
      return;
    }

    if (navigation?.reset) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Gym Files' }],
      });
      return;
    }

    if (navigation?.navigate) {
      navigation.navigate('Gym Files');
    }
  }

  async function handleLogin() {
    if (!identifier || !password) {
      setLoginError('Informe e-mail ou nome de usuário e senha.');
      return;
    }

    const isEmail = identifier.includes('@');

    setLoginError('');
    setLoading(true);

    try {
      const response = await api.post('/login', isEmail
        ? { email: identifier, password }
        : { username: identifier, password });

      const token = response?.data?.token;

      if (token) {
        await completeLogin(token);
      } else {
        setLoginError('Login realizado, mas o servidor não retornou um token.');
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Erro no login';

      setLoginError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    if (!googleClientId) {
      const variableName = Platform.select({
        ios: 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
        android: 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
        default: 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
      });
      setLoginError(`Adicione ${variableName} ao client/.env e reinicie o Expo.`);
      return;
    }

    if (!googleRequest) {
      setLoginError('A autenticação do Google ainda está sendo preparada. Tente novamente em instantes.');
      return;
    }

    setLoginError('');
    setLoading(true);

    try {
      // Gera nonce fresco para esta tentativa
      const nonce = await generateNonce();

      // Passa nonce via extraParams no prompt (forma correta com expo-auth-session)
      const result = await promptGoogleLogin({ extraParams: { prompt: 'select_account', nonce } });
      if (result.type !== 'success') {
        return;
      }

      const idToken = result.params.id_token;
      if (!idToken) {
        throw new Error('O Google não retornou um ID token. Confira o Client ID OAuth configurado.');
      }

      // Recupera o nonce salvo para validação no servidor
      const savedNonce = await getNonce();
      if (!savedNonce) {
        throw new Error('Nonce de autenticação perdido. Tente novamente.');
      }

      const response = await api.post('/auth/google', { idToken, nonce: savedNonce });
      const appToken = response?.data?.token;

      if (!appToken) {
        throw new Error('O servidor não retornou o token da aplicação.');
      }

      // Limpa o nonce após uso bem-sucedido
      await clearNonce();

      await completeLogin(appToken);
    } catch (error: any) {
      // Limpa nonce em caso de erro
      await clearNonce().catch(() => {});

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Não foi possível entrar com o Google.';

      setLoginError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>Entre com sua conta</Text>
        {loginError ? (
          <Text
            style={styles.errorMessage}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            {loginError}
          </Text>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="E-mail ou nome de usuário"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          keyboardType="default"
        />

        <TextInput
          style={styles.input}
          placeholder="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Entrando...' : 'Entrar'}</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>ou</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.googleButton, loading && styles.buttonDisabled]}
          onPress={handleGoogleLogin}
          disabled={loading}
          accessibilityRole="button"
          accessibilityLabel="Entrar com Google"
        >
          <FontAwesome name="google" size={18} color="#4285F4" />
          <Text style={styles.googleButtonText}>{loading ? 'Conectando...' : 'Continuar com Google'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  errorMessage: {
    color: '#b42318',
    backgroundColor: '#fef3f2',
    borderWidth: 1,
    borderColor: '#fecdca',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    color: '#6b7280',
    fontSize: 13,
  },
  googleButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleButtonText: {
    color: '#1f2937',
    fontWeight: '600',
    fontSize: 15,
  },
});
