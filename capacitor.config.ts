import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'net.garybully.chatbox',
  appName: 'Chatbox',
  webDir: 'release/app/dist/renderer',
  android: {
    allowMixedContent: true,
  },
}

export default config
