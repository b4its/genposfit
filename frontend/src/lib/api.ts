/**
 * Resolution of API endpoints for GenPosFit.
 *
 * Strategy:
 * 1. VITE_API_URL set   → explicit override (e.g. http://ip-host:8042).
 * 2. Default (empty)    → SAME-ORIGIN: all requests to /api go through
 *    the server that hosts the frontend (Vite dev/prod proxy to the host
 *    backend). This avoids CORS, mixed content (https→http), and always
 *    follows the host IP whoever accesses it — never client localhost.
 */

export function getApiUrl(): string {
  const envUrl = import.meta.env?.VITE_API_URL;
  if (envUrl) return String(envUrl).replace(/\/+$/, '');
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

export function getWsUrl(): string {
  const envUrl = import.meta.env?.VITE_API_URL;
  const base = envUrl ? String(envUrl) : (typeof window !== 'undefined' ? window.location.origin : '');
  if (base.startsWith('https')) return base.replace(/^https/, 'wss');
  return base.replace(/^http/, 'ws');
}
