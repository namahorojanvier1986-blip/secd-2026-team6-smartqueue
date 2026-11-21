// Thin wrapper around fetch for the Smart Queue REST API.
const BASE = (import.meta.env.VITE_API_URL || '') + '/api';
const SESSION_KEY = 'sq_session';

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

export function setSession(session) {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

export async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const s = getSession();
    if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  }
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection.', 0);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    if (res.status === 401 && auth) setSession(null);
    // Fresh installation: send everyone to the first-run setup
    if (res.status === 503 && data?.errorCode === 'SETUP_REQUIRED' && window.location.pathname !== '/setup') {
      window.location.assign('/setup');
    }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  }
  return data;
}

// Remember the customer's last ticket on this device
const TICKET_KEY = 'sq_my_ticket';
export const myTicket = {
  get: () => localStorage.getItem(TICKET_KEY),
  set: (code) => localStorage.setItem(TICKET_KEY, code),
  clear: () => localStorage.removeItem(TICKET_KEY),
};
