export const GATEWAY_URL_STORAGE_KEY = 'gyshell-mobile-gateway-url'
export const GATEWAY_AUTO_CONNECT_STORAGE_KEY = 'gyshell-mobile-gateway-auto-connect'

export function defaultGatewayUrl(): string {
  const host = window.location.hostname || '127.0.0.1'
  return `ws://${host}:17888`
}

export function normalizeGatewayUrl(raw: string): string {
  const input = String(raw || '').trim()
  if (!input) return defaultGatewayUrl()
  if (input.startsWith('ws://') || input.startsWith('wss://')) return input
  if (input.startsWith('http://')) return `ws://${input.slice('http://'.length)}`
  if (input.startsWith('https://')) return `wss://${input.slice('https://'.length)}`
  return `ws://${input}`
}

export function loadGatewayUrlFromStorage(): string {
  return window.localStorage.getItem(GATEWAY_URL_STORAGE_KEY) || defaultGatewayUrl()
}

export function saveGatewayUrlToStorage(url: string): void {
  window.localStorage.setItem(GATEWAY_URL_STORAGE_KEY, url)
}

export function loadGatewayAutoConnectFromStorage(): boolean {
  return window.localStorage.getItem(GATEWAY_AUTO_CONNECT_STORAGE_KEY) === '1'
}

export function saveGatewayAutoConnectToStorage(enabled: boolean): void {
  window.localStorage.setItem(GATEWAY_AUTO_CONNECT_STORAGE_KEY, enabled ? '1' : '0')
}
