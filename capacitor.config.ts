import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.garybully.chatboss',
  appName: 'chatboss',
  webDir: 'release/app/dist/renderer',
  android: {
    allowMixedContent: true,
  },
}

export default config
