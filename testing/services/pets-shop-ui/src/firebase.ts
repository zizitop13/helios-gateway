import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { runtimeEnv, type PetsShopRuntimeConfig } from './runtimeConfig';

function requiredEnv(name: keyof PetsShopRuntimeConfig): string {
  const value = runtimeEnv(name);
  if (!value) {
    throw new Error(`Missing required Firebase environment variable: ${name}`);
  }
  return value;
}

const firebaseConfig = {
  apiKey: requiredEnv('VITE_FIREBASE_API_KEY'),
  authDomain: requiredEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: requiredEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: requiredEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: requiredEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: requiredEnv('VITE_FIREBASE_APP_ID'),
  measurementId: runtimeEnv('VITE_FIREBASE_MEASUREMENT_ID'),
};

const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
