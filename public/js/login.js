document.addEventListener('DOMContentLoaded', function () {
  // Auto-forward already logged users: teacher → dashboard, student → own portal
  fetch('/api/portal/me').then(r => r.json()).then(me => {
    if (!me || !me.loggedIn) return;
    if (me.role === 'teacher') window.location.href = '/teacher/dashboard';
    else if (me.role === 'student' && me.className) window.location.href = '/portal/' + me.className.toLowerCase().replace(' ', '-');
  }).catch(() => {});

  const showBox = document.getElementById('showPass');
  if (showBox) showBox.addEventListener('change', function () {
    document.getElementById('password').type = showBox.checked ? 'text' : 'password';
  });

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
        body: JSON.stringify({ identifier, password })
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        if (data.role === 'teacher') window.location.href = '/teacher/dashboard';
        else if (data.role === 'student' && data.className) window.location.href = '/portal/' + data.className.toLowerCase().replace(' ', '-');
        else window.location.href = '/portal';
      } else {
        errEl.textContent = data.error || 'Invalid login';
        errEl.style.display = 'block';
      }
    } catch (err) {
      errEl.textContent = 'Connection error';
      errEl.style.display = 'block';
    }
    btn.disabled = false;
    btn.textContent = 'Sign In';
  });
});
