// Pausenzeit auf dem Sperrbildschirm: Eine Web-App darf dort nichts anzeigen, außer sie spielt Ton.
// Deshalb läuft in der Pause eine stumme Tonspur in genau der Länge der Pause. iOS zeigt sie als
// „Wird gerade gespielt“ mit Restzeit an. Am Ende der Spur sitzt der Signalton, so kommt er auch
// bei gesperrtem Handy, wenn die App selbst gar nicht mehr rechnet.
import { state } from './store.js';

const RATE = 11025;
let audio = null, url = null, active = false, onSkip = null;

/** WAV (8 Bit, mono): Stille + drei kurze Töne. */
function restWav(seconds) {
  const silent = Math.round(seconds * RATE), tail = RATE; // 1 s Signalton
  const n = silent + tail;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  str(36, 'data'); v.setUint32(40, n, true);
  const data = new Uint8Array(buf, 44);
  data.fill(128);
  for (let b = 0; b < 3; b++) {
    const from = silent + Math.round(b * 0.3 * RATE), len = Math.round(0.18 * RATE);
    for (let i = 0; i < len; i++) data[from + i] = 128 + Math.round(90 * Math.sin((2 * Math.PI * 880 * i) / RATE));
  }
  return new Blob([buf], { type: 'audio/wav' });
}

/** Muss direkt aus einem Tippen heraus aufgerufen werden, sonst verweigert iOS den Ton. */
export function restLockStart({ seconds, title, artist, skip }) {
  if (!state.settings.lockRest || seconds <= 0) { restLockStop(); return; }
  if (!audio) {
    audio = new Audio();
    audio.setAttribute('playsinline', '');
    audio.addEventListener('ended', restLockStop);
  }
  if (url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(restWav(seconds));
  audio.src = url;
  active = true;
  onSkip = skip;
  audio.play().catch(() => { active = false; });
  const ms = navigator.mediaSession;
  if (!ms) return;
  ms.metadata = new MediaMetadata({ title, artist, album: 'Gradient', artwork: [{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }] });
  const end = () => onSkip?.();
  try { ms.setActionHandler('nexttrack', end); ms.setActionHandler('pause', end); } catch {}
}

export function restLockStop() {
  if (!active && !audio?.src) return;
  active = false;
  onSkip = null;
  audio?.pause();
  audio?.removeAttribute('src');
  const ms = navigator.mediaSession;
  if (ms) {
    ms.metadata = null;
    try { ms.setActionHandler('nexttrack', null); ms.setActionHandler('pause', null); } catch {}
  }
}

export const restLockActive = () => active;
