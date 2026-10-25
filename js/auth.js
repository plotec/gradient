// Anmelde- und Registrierungsbildschirm.
import { register, login, cloudEnabled, AuthError } from './cloud.js';
import { hasLegacyData } from './store.js';
import { esc } from './utils.js';
import { logoSvg } from './dashboard.js';

/** Zeigt den Login und ruft onDone(session, { isNew }) nach Erfolg auf. */
export function showLogin(onDone) {
  let mode = 'login';
  let error = '';
  let busy = false;
  const root = document.getElementById('view');
  document.getElementById('tabbar').hidden = true;

  function draw() {
    const name = root.querySelector('#auth-name')?.value ?? '';
    root.innerHTML = `
      <div class="auth">
        <div class="brand" style="font-size:30px">${logoSvg()}Gradient</div>
        <div><h1 class="auth-title">${mode === 'login' ? 'Willkommen zurück' : 'Account anlegen'}</h1>
          <p class="muted" style="margin:6px 0 0">${mode === 'login' ? 'Melde dich mit deinem Namen und Passwort an.' : 'Deine Übungen, Mahlzeiten und Werte werden unter diesem Account gespeichert.'}</p></div>
        <form class="stack" data-submit="auth-submit" id="auth-form" autocomplete="on">
          <label class="field"><span>Name</span><input class="input" id="auth-name" name="username" autocomplete="username" autocapitalize="none" value="${esc(name)}" required></label>
          <label class="field"><span>Passwort</span><input class="input" id="auth-pw" type="password" name="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" required minlength="6"></label>
          ${mode === 'register' ? '<label class="field"><span>Passwort wiederholen</span><input class="input" id="auth-pw2" type="password" autocomplete="new-password" required minlength="6"></label>' : ''}
          ${error ? `<div class="auth-error" role="alert">${esc(error)}</div>` : ''}
          <button class="btn primary lg block" ${busy ? 'disabled' : ''}>${busy ? 'Einen Moment …' : mode === 'login' ? 'Anmelden' : 'Account anlegen'}</button>
        </form>
        <button class="link" data-act="auth-mode" style="align-self:center">${mode === 'login' ? 'Noch keinen Account? Jetzt anlegen' : 'Schon einen Account? Anmelden'}</button>
        <p class="tiny faint" style="text-align:center;margin:0">${cloudEnabled ? 'Deine Daten werden in deinem Account gespeichert und auf allen Geräten synchronisiert.' : 'Lokaler Modus: Accounts und Daten liegen nur auf diesem Gerät. Für Accounts auf mehreren Geräten muss die Cloud eingerichtet werden (siehe README).'}</p>
      </div>`;
    if (!name) root.querySelector('#auth-name')?.focus();
  }

  const onClick = (e) => {
    if (e.target.closest('[data-act="auth-mode"]')) { mode = mode === 'login' ? 'register' : 'login'; error = ''; draw(); }
  };
  const onSubmit = async (e) => {
    if (!e.target.closest('#auth-form')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const name = root.querySelector('#auth-name').value;
    const pw = root.querySelector('#auth-pw').value;
    if (mode === 'register' && pw !== root.querySelector('#auth-pw2').value) { error = 'Die Passwörter stimmen nicht überein.'; draw(); return; }
    busy = true; error = ''; draw();
    root.querySelector('#auth-name').value = name;
    try {
      const adoptLegacy = mode === 'register' && hasLegacyData();
      const session = mode === 'login' ? await login(name, pw) : await register(name, pw);
      cleanup();
      document.getElementById('tabbar').hidden = false;
      onDone(session, { isNew: mode === 'register', adoptLegacy });
    } catch (err) {
      busy = false;
      error = err instanceof AuthError ? err.message : 'Das hat nicht geklappt. Bitte nochmal versuchen.';
      console.warn(err);
      draw();
      root.querySelector('#auth-name').value = name;
    }
  };
  function cleanup() {
    root.removeEventListener('click', onClick);
    document.removeEventListener('submit', onSubmit, true);
  }
  root.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit, true);
  draw();
}
