const DEFAULT_PORT = '8042';

export function getApiUrl(): string {
  const envUrl = import.meta.env?.VITE_API_URL;
  if (envUrl) return envUrl;
  return `http://${window.location.hostname}:${DEFAULT_PORT}`;
}

export function getWsUrl(): string {
  return getApiUrl().replace(/^http/, 'ws');
}