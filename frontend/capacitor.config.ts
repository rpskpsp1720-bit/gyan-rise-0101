// Capacitor configuration — GYAN RISE Android wrapper
//
// The Android shell loads your deployed website at server.url.
// Update the URL below to your real Vercel production URL before
// building the release APK/AAB.

import type { CapacitorConfig } from '@capacitor/cli';

const LIVE_URL =
  process.env.CAPACITOR_LIVE_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'https://app-dev-358.preview.emergentagent.com';

const config: CapacitorConfig = {
  appId: 'com.gyanrise.lms',
  appName: 'GYAN RISE',
  webDir: 'build',
  bundledWebRuntime: false,
  server: {
    // Live web app — Android WebView loads your Vercel site directly.
    url: LIVE_URL,
    // Force HTTPS only. Capacitor blocks mixed-content by default.
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    // The app explicitly opts out of allowing arbitrary HTTP origins
    // and disallows file:// URI access for safety.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#0B1E55',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      androidSpinnerStyle: 'small',
      spinnerColor: '#F97316',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      backgroundColor: '#0B1E55',
      style: 'DARK',
      overlaysWebView: false,
    },
  },
};

export default config;
