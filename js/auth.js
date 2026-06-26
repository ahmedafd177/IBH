/* ═══════════════════════════════════════
   AUTH — customer-facing sign in / register
   Works alongside api.js (Bearer token auto-injected)
   ═══════════════════════════════════════ */
const Auth = (() => {
  const SESSION_KEY = 'ibh_session';
  const USER_KEY    = 'ibh_user';

  /* ── current user (null if not logged in) ── */
  let _user = null;

  function currentUser() { return _user; }

  function _saveSession(data) {
    localStorage.setItem(SESSION_KEY, data.token);
    const u = { id: data.id, name: data.name, phone: data.phone, email: data.email, role: data.role };
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    /* Keep checkout in sync — it reads ibh_account */
    localStorage.setItem('ibh_account', JSON.stringify({
      type: 'account', name: data.name, phone: data.phone || '', email: data.email || '',
    }));
    _user = u;
    _updateHeader();
  }

  function _updateHeader() {
    const btn   = document.getElementById('auth-btn');
    const label = document.getElementById('auth-btn-label');
    if (!btn || !label) return;
    if (_user) {
      label.textContent    = _user.name.split(' ')[0];
      label.style.display  = '';
      btn.title            = `Signed in as ${_user.name}`;
    } else {
      label.style.display  = 'none';
      btn.title            = 'Sign In / My Account';
    }
  }

  /* ── open / close modal ── */
  function openModal(tab = 'login') {
    const overlay = document.getElementById('auth-overlay');
    const modal   = document.getElementById('auth-modal');
    if (!overlay) return;
    overlay.classList.add('open');
    modal?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    _showTab(tab);
    document.getElementById('auth-error').style.display = 'none';
  }

  function closeModal() {
    const overlay = document.getElementById('auth-overlay');
    const modal   = document.getElementById('auth-modal');
    overlay?.classList.remove('open');
    modal?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function _showTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('auth-login-form').style.display    = isLogin ? '' : 'none';
    document.getElementById('auth-register-form').style.display = isLogin ? 'none' : '';
    document.getElementById('auth-tab-login').style.cssText     =
      isLogin ? 'flex:1;padding:.625rem;font-size:.875rem;font-weight:700;color:var(--blue);border:none;background:none;border-bottom:2px solid var(--blue);margin-bottom:-2px;cursor:pointer;font-family:inherit'
              : 'flex:1;padding:.625rem;font-size:.875rem;font-weight:600;color:var(--n-500);border:none;background:none;cursor:pointer;font-family:inherit';
    document.getElementById('auth-tab-register').style.cssText  =
      !isLogin ? 'flex:1;padding:.625rem;font-size:.875rem;font-weight:700;color:var(--blue);border:none;background:none;border-bottom:2px solid var(--blue);margin-bottom:-2px;cursor:pointer;font-family:inherit'
               : 'flex:1;padding:.625rem;font-size:.875rem;font-weight:600;color:var(--n-500);border:none;background:none;cursor:pointer;font-family:inherit';
  }

  function _showError(msg) {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  /* ── sign out ── */
  function signOut() {
    const token = localStorage.getItem(SESSION_KEY);
    if (token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('ibh_account'); /* clear checkout user too */
    _user = null;
    _updateHeader();
    if (typeof App !== 'undefined') App.toast('Signed out', '');
  }

  /* ── init: restore session + wire up events ── */
  async function init() {
    /* Restore from localStorage */
    const saved = localStorage.getItem(USER_KEY);
    if (saved) {
      try { _user = JSON.parse(saved); } catch {}
    }
    _updateHeader();

    /* Silently validate the stored session */
    const token = localStorage.getItem(SESSION_KEY);
    if (token) {
      try {
        const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
          _user = await res.json();
          localStorage.setItem(USER_KEY, JSON.stringify(_user));
        } else {
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(USER_KEY);
          _user = null;
        }
      } catch {}
      _updateHeader();
    }

    /* Bind header auth button */
    document.getElementById('auth-btn')?.addEventListener('click', () => {
      if (_user) {
        /* Already signed in → show sign-out option */
        if (confirm(`Signed in as ${_user.name}\n\nSign out?`)) signOut();
      } else {
        openModal('login');
      }
    });

    /* Close modal */
    document.getElementById('auth-modal-close')?.addEventListener('click', closeModal);
    document.getElementById('auth-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'auth-overlay') closeModal();
    });

    /* Tabs */
    document.getElementById('auth-tab-login')?.addEventListener('click',    () => { _showTab('login');    document.getElementById('auth-error').style.display='none'; });
    document.getElementById('auth-tab-register')?.addEventListener('click', () => { _showTab('register'); document.getElementById('auth-error').style.display='none'; });

    /* Sign-in form */
    document.getElementById('auth-login-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      document.getElementById('auth-error').style.display = 'none';
      const btn = document.getElementById('auth-login-btn');
      btn.disabled = true; btn.textContent = 'Signing in…';
      try {
        const res  = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier: document.getElementById('auth-identifier').value.trim(),
            password:   document.getElementById('auth-password').value,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        _saveSession(data);
        closeModal();
        if (typeof App !== 'undefined') App.toast(`Welcome back, ${data.name.split(' ')[0]}!`, 'success');
      } catch (err) {
        _showError(err.message);
      } finally {
        btn.disabled = false; btn.textContent = 'Sign In';
      }
    });

    /* Register form */
    document.getElementById('auth-register-form')?.addEventListener('submit', async e => {
      e.preventDefault();
      document.getElementById('auth-error').style.display = 'none';
      const btn = document.getElementById('auth-register-btn');
      btn.disabled = true; btn.textContent = 'Creating account…';
      try {
        const res  = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name:     document.getElementById('reg-name').value.trim(),
            phone:    document.getElementById('reg-phone').value.trim(),
            email:    document.getElementById('reg-email').value.trim(),
            password: document.getElementById('reg-password').value,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        _saveSession(data);
        closeModal();
        if (typeof App !== 'undefined') App.toast(`Welcome, ${data.name.split(' ')[0]}!`, 'success');
      } catch (err) {
        _showError(err.message);
      } finally {
        btn.disabled = false; btn.textContent = 'Create Account';
      }
    });

    /* Google Sign-In */
    if (typeof google !== 'undefined' && Config.GOOGLE_CLIENT_ID) {
      google.accounts.id.initialize({
        client_id: Config.GOOGLE_CLIENT_ID,
        callback: async (response) => {
          document.getElementById('auth-error').style.display = 'none';
          try {
            const res  = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential: response.credential }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Google sign-in failed');
            _saveSession(data);
            closeModal();
            if (typeof App !== 'undefined') App.toast(`Welcome, ${data.name.split(' ')[0]}!`, 'success');
          } catch (err) {
            _showError(err.message);
          }
        },
      });
      google.accounts.id.renderButton(
        document.getElementById('auth-google-btn'),
        { theme: 'outline', size: 'large', width: 300, text: 'signin_with' },
      );
    } else {
      document.getElementById('auth-google-section').style.display = 'none';
    }
  }

  return { init, openModal, closeModal, signOut, currentUser };
})();
