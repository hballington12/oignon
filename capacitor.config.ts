import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.oignon.app',
  appName: 'Oignon',
  webDir: 'dist',
  server: {
    allowNavigation: ['api.openalex.org'],
  },
  ios: {
    allowsLinkPreview: false,
  },
}

export default config
