// Accounts (Name + Passwort) und Synchronisierung der Daten.
// Mit Supabase-Konfiguration: echte Cloud-Accounts, Daten auf allen Geräten.
// Ohne: lokale Accounts auf diesem Gerät (Passwort als SHA-256-Hash mit Salt).
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { state, replaceState } from './store.js';

export const cloudEnabled = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
const SESSION_KEY = 'formkurve-session';
const ACCOUNTS_KEY = 'formkurve-accounts';

const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let session = read(SESSION_KEY);
export const currentSession = () => session;

/** "Max Müller" -> "max-mueller" (Login-Name, Groß/Klein egal). */
export function slugName(name) {
  return String(name).trim().toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}
const emailFor = (name) => `${slugName(name)}@users.formkurve.app`;

class AuthError extends Error {}
export { AuthError };

// ---------- Supabase Auth (REST) ----------
async function sbAuth(path, body, token) {
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: path === 'user' ? 'PUT' : 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  } catch { throw new AuthError('Keine Verbindung zum Server. Bist du online?'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.msg || data.error_description || data.message || '';
    if (/already registered|already exists/i.test(msg)) throw new AuthError('Diesen Namen gibt es schon. Melde dich an oder wähle einen anderen Namen.');
    if (/invalid login|invalid credentials/i.test(msg)) throw new AuthError('Name oder Passwort stimmt nicht.');
    if (/password/i.test(msg) && /characters|short|weak/i.test(msg)) throw new AuthError('Das Passwort ist zu kurz (mindestens 6 Zeichen).');
    if (/confirm/i.test(msg)) throw new AuthError('Der Account muss erst bestätigt werden. Bitte in Supabase „Confirm email“ ausschalten (siehe Anleitung).');
    throw new AuthError(msg || `Anmeldung fehlgeschlagen (${res.status}).`);
  }
  return data;
}
function sessionFrom(data, name) {
  if (!data.access_token) throw new AuthError('Der Account muss erst bestätigt werden. Bitte in Supabase „Confirm email“ ausschalten (siehe Anleitung).');
  return {
    mode: 'cloud', name: data.user?.user_metadata?.display_name || name, userId: data.user.id,
    access_token: data.access_token, refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };
}

// ---------- Lokale Accounts ----------
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- Öffentliche API ----------
export async function register(name, password) {
  name = name.trim();
  if (slugName(name).length < 2) throw new AuthError('Bitte einen Namen mit mindestens 2 Zeichen eingeben.');
  if (password.length < 6) throw new AuthError('Das Passwort braucht mindestens 6 Zeichen.');
  if (cloudEnabled) {
    const data = await sbAuth('signup', { email: emailFor(name), password, data: { display_name: name } });
    session = sessionFrom(data, name);
  } else {
    const accounts = read(ACCOUNTS_KEY) || {};
    const id = slugName(name);
    if (accounts[id]) throw new AuthError('Diesen Namen gibt es auf diesem Gerät schon. Melde dich an.');
    const salt = crypto.getRandomValues(new Uint32Array(4)).join('-');
    accounts[id] = { name, salt, hash: await sha256(`${salt}:${password}`) };
    write(ACCOUNTS_KEY, accounts);
    session = { mode: 'local', name, userId: `local-${id}` };
  }
  write(SESSION_KEY, session);
  return session;
}

export async function login(name, password) {
  if (cloudEnabled) {
    const data = await sbAuth('token?grant_type=password', { email: emailFor(name), password });
    session = sessionFrom(data, name.trim());
  } else {
    const acc = (read(ACCOUNTS_KEY) || {})[slugName(name)];
    if (!acc || acc.hash !== await sha256(`${acc.salt}:${password}`)) throw new AuthError('Name oder Passwort stimmt nicht.');
    session = { mode: 'local', name: acc.name, userId: `local-${slugName(name)}` };
  }
  write(SESSION_KEY, session);
  return session;
}

export async function changePassword(oldPw, newPw) {
  if (newPw.length < 6) throw new AuthError('Das neue Passwort braucht mindestens 6 Zeichen.');
  if (session.mode === 'cloud') {
    await login(session.name, oldPw);
    await sbAuth('user', { password: newPw }, await accessToken());
  } else {
    const accounts = read(ACCOUNTS_KEY) || {};
    const id = slugName(session.name);
    const acc = accounts[id];
    if (!acc || acc.hash !== await sha256(`${acc.salt}:${oldPw}`)) throw new AuthError('Das bisherige Passwort stimmt nicht.');
    acc.hash = await sha256(`${acc.salt}:${newPw}`);
    write(ACCOUNTS_KEY, accounts);
  }
}

export async function logout() {
  await flushSync().catch(() => {});
  if (session?.mode === 'cloud') {
    fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` } }).catch(() => {});
  }
  session = null;
  write(SESSION_KEY, null);
}

/** Gültiges Zugriffstoken (erneuert bei Bedarf). */
export async function accessToken() {
  if (!session || session.mode !== 'cloud') return null;
  if (Date.now() < session.expires_at - 60000) return session.access_token;
  const data = await sbAuth('token?grant_type=refresh_token', { refresh_token: session.refresh_token });
  session = { ...sessionFrom(data, session.name), name: session.name };
  write(SESSION_KEY, session);
  return session.access_token;
}

// ---------- Synchronisierung (lokal zuerst, Cloud im Hintergrund) ----------
let syncStatus = 'aus';
let lastSynced = 0;
let pushTimer = null;
const statusListeners = new Set();
export const onSyncStatus = (fn) => statusListeners.add(fn);
export const getSyncStatus = () => syncStatus;
const setStatus = (s) => { syncStatus = s; statusListeners.forEach((fn) => fn(s)); };

export const restCall = (...a) => rest(...a);
async function rest(path, opts = {}) {
  const token = await accessToken();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) throw new Error(`Sync ${res.status}`);
  return res.status === 204 ? null : res.json().catch(() => null);
}

/** Nach dem Login: neueren Stand gewinnen lassen. */
export async function pullAndMerge() {
  if (session?.mode !== 'cloud') return;
  setStatus('lädt');
  try {
    const rows = await rest(`user_data?select=data,updated_at&user_id=eq.${session.userId}`);
    const remote = rows?.[0]?.data;
    const localT = state._modifiedAt || 0;
    const remoteT = remote?._modifiedAt || 0;
    if (remote && remoteT > localT) {
      lastSynced = remoteT;
      replaceState(remote, { fromCloud: true });
      setStatus('synchron');
    } else if (!remote || localT > remoteT) {
      await push();
    } else {
      lastSynced = localT;
      setStatus('synchron');
    }
  } catch (e) {
    console.warn(e);
    setStatus(navigator.onLine ? 'Fehler' : 'offline');
  }
}

async function push() {
  if (session?.mode !== 'cloud') return;
  const t = state._modifiedAt || Date.now();
  setStatus('speichert');
  try {
    await rest('user_data', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ user_id: session.userId, data: state, updated_at: new Date().toISOString() }),
    });
    lastSynced = t;
    setStatus('synchron');
  } catch (e) {
    console.warn(e);
    setStatus(navigator.onLine ? 'Fehler' : 'offline');
  }
}

/** Hook für den Store: nach lokalen Änderungen verzögert hochladen. */
export function schedulePush() {
  if (session?.mode !== 'cloud') return;
  if ((state._modifiedAt || 0) <= lastSynced) return;
  setStatus('ausstehend');
  clearTimeout(pushTimer);
  pushTimer = setTimeout(push, 1500);
}
export async function flushSync() {
  clearTimeout(pushTimer);
  if (session?.mode === 'cloud' && (state._modifiedAt || 0) > lastSynced) await push();
}
window.addEventListener('online', () => schedulePush());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flushSync();
  else if (session?.mode === 'cloud') pullAndMerge();
});
