function resetLoginInputs() {
  const identEl = document.getElementById('identifier');
  const passEl = document.getElementById('password');
  const errEl = document.getElementById('loginError');
  if (identEl) identEl.value = '';
  if (passEl) passEl.value = '';
  if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
}

function portalPathFor(me) {
  if (!me) return null;
  if (me.role === 'teacher') return '/teacher/dashboard';
  if (me.role === 'student' && me.className) return '/portal/' + me.className.toLowerCase().replace(' ', '-');
  return null;
}

function showLoggedOutMessage() {
  const errEl = document.getElementById('loginError');
  if (!errEl) return;
  errEl.textContent = 'Logged out successfully. Sibling 2 can now log in.';
  errEl.style.display = 'block';
  errEl.style.background = '#e8f5e9';
  errEl.style.color = '#2e7d32';
  errEl.style.border = '1px solid #a5d6a7';
}

function showAlreadyLoggedIn(me) {
  const card = document.querySelector('.login-card');
  if (!card || document.getElementById('switchAccountBar')) return;
  const bar = document.createElement('div');
  bar.id = 'switchAccountBar';
  bar.style.cssText = 'margin-bottom:1rem;padding:.8rem;border:1px solid var(--border);border-radius:8px;background:#f8f9fa;display:flex;flex-direction:column;gap:.6rem';
  const who = me.role === 'teacher' ? 'Teacher' : (me.name || me.className || 'Student');
  bar.innerHTML =
    '<div>Logged in as <strong></strong>. Not you (sibling)?</div>' +
    '<div style="display:flex;gap:.5rem;flex-wrap:wrap">' +
    '<button type="button" class="btn btn-primary" id="continueBtn">Continue</button>' +
    '<button type="button" class="btn btn-danger" id="switchBtn">Switch account / Logout</button>' +
    '</div>';
  bar.querySelector('strong').textContent = who;
  card.insertBefore(bar, card.querySelector('form'));
  document.getElementById('continueBtn').addEventListener('click', () => {
    const dest = portalPathFor(me);
    if (dest) window.location.href = dest;
  });
  document.getElementById('switchBtn').addEventListener('click', async () => {
    const btn = document.getElementById('switchBtn');
    btn.disabled = true;
    btn.textContent = 'Logging out...';
    try { await fetch('/api/logout', { method: 'POST', cache: 'no-store', credentials: 'same-origin' }); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    try { localStorage.clear(); } catch (e) {}
    bar.remove();
    resetLoginInputs();
    showLoggedOutMessage();
    try { window.history.replaceState({}, '', '/login?loggedout=1'); } catch (e) {}
  });
}

async function checkExistingSession() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('loggedout')) {
      resetLoginInputs();
      showLoggedOutMessage();
      return;
    }
    const r = await fetch('/api/portal/me', { cache: 'no-store', credentials: 'same-origin' });
    const me = await r.json();
    if (me && me.loggedIn) showAlreadyLoggedIn(me);
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', function () {
  resetLoginInputs();
  checkExistingSession();

  const errEl = document.getElementById('loginError');
  const form = document.getElementById('loginForm');
  const btn = document.getElementById('loginBtn');
  const identEl = document.getElementById('identifier');
  identEl.addEventListener('input', () => { errEl.style.display = 'none'; });
  document.getElementById('password').addEventListener('input', () => { errEl.style.display = 'none'; });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const rawIdentifier = identEl.value.trim();
    const identifier = rawIdentifier.includes('@') ? rawIdentifier : rawIdentifier.toLowerCase();
    const password = document.getElementById('password').value;
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
        body: JSON.stringify({ identifier, password })
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        resetLoginInputs();
        // Replace history so Back never lands back on the previous sibling's portal.
        if (data.role === 'teacher') window.location.replace('/teacher/dashboard');
        else if (data.role === 'student' && data.className) window.location.replace('/portal/' + data.className.toLowerCase().replace(' ', '-'));
        else window.location.replace('/portal');
      } else {
        errEl.textContent = data.error || 'Invalid login';
        errEl.style.display = 'block';
        errEl.style.background = '';
        errEl.style.color = '';
        errEl.style.border = '';
        document.getElementById('password').value = '';
      }
    } catch (err) {
      errEl.textContent = 'Connection error';
      errEl.style.display = 'block';
    }
    btn.disabled = false;
    btn.textContent = 'Sign In';
  });
});

window.addEventListener('pageshow', function (e) {
  resetLoginInputs();
  if (e.persisted) checkExistingSession();
});
