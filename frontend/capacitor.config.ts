import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.aravind.getvideo',
  appName: 'AK Downloader & Panda Compress',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
}

export default config
