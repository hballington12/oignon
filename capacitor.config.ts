import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.oignon.app',
  appName: 'Oignon',
  webDir: 'dist',
  server: {
    allowNavigation: ['api.openalex.org', 'api.api-ninjas.com'],
  },
  ios: {
    allowsLinkPreview: false,
  },
}

export default config
