export function getApiBaseUrl(): string {
  // 1. Check user custom URL stored in localStorage (e.g. entered via app settings)
  try {
    const custom = localStorage.getItem('ak_api_url')
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/$/, '')
    }
  } catch {
    // ignore
  }

  // 2. Check environment variable (Vite)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '')
  }

  // 3. If running inside native Android WebView (Capacitor)
  const isCapacitor =
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && !window.location.port)

  if (isCapacitor) {
    // Default to computer's local Wi-Fi IP address
    return 'http://192.168.1.3:8000'
  }

  // 4. Default web browser behavior (relative URL through Vite proxy)
  return ''
}

export function setCustomApiUrl(url: string) {
  try {
    if (!url.trim()) {
      localStorage.removeItem('ak_api_url')
    } else {
      localStorage.setItem('ak_api_url', url.trim())
    }
  } catch {
    // ignore
  }
}
