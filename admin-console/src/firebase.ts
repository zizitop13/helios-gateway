import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { api } from './api';
import type { FirebaseWebConfig } from './types';

export let firebaseAuth: Auth | null = null;

function isValidFirebaseConfig(config: FirebaseWebConfig): config is Required<Pick<FirebaseWebConfig, 'apiKey' | 'authDomain' | 'projectId' | 'appId'>> & FirebaseWebConfig {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

function getFirebaseConfigFromEnv(): FirebaseWebConfig {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  };
}

async function resolveFirebaseConfig(): Promise<FirebaseOptions> {
  const envConfig = getFirebaseConfigFromEnv();
  if (isValidFirebaseConfig(envConfig)) {
    return envConfig;
  }

  let runtimeConfig: FirebaseWebConfig | undefined;

  try {
    runtimeConfig = await api.getFirebaseConfig();
  } catch {
    runtimeConfig = undefined;
  }

  if (runtimeConfig && isValidFirebaseConfig(runtimeConfig)) {
    return runtimeConfig;
  }

  throw new Error('Firebase configuration is missing. Provide VITE_FIREBASE_* variables for local admin-console development or configure ADMIN_CONSOLE_FIREBASE_* variables on the gateway.');
}

export async function initializeFirebaseAuth(): Promise<Auth> {
  if (firebaseAuth) {
    return firebaseAuth;
  }

  const firebaseConfig = await resolveFirebaseConfig();
  const firebaseApp = initializeApp(firebaseConfig);
  firebaseAuth = getAuth(firebaseApp);
  return firebaseAuth;
}
