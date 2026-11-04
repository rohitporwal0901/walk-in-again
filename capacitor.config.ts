import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.walkinagain.physio',
  appName: 'Walk In Again',
  webDir: 'dist/walkin-physio/browser',
  server: {
    androidScheme: 'https'
  }
};

export default config;
