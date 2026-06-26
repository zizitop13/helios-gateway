export interface PetsShopRuntimeConfig {
  VITE_GATEWAY_URL?: string;
  VITE_FIREBASE_API_KEY?: string;
  VITE_FIREBASE_AUTH_DOMAIN?: string;
  VITE_FIREBASE_PROJECT_ID?: string;
  VITE_FIREBASE_STORAGE_BUCKET?: string;
  VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  VITE_FIREBASE_APP_ID?: string;
  VITE_FIREBASE_MEASUREMENT_ID?: string;
}

declare global {
  interface Window {
    __PETS_SHOP_CONFIG__?: PetsShopRuntimeConfig;
  }
}

export function runtimeEnv(name: keyof PetsShopRuntimeConfig): string | undefined {
  return window.__PETS_SHOP_CONFIG__?.[name] || import.meta.env[name as keyof ImportMetaEnv];
}
