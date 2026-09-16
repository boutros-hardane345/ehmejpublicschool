document.addEventListener('DOMContentLoaded', function () {
  document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errEl = document.getElementById('loginError');
    try {
      const r = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (r.ok) {
        window.location.href = '/teacher/dashboard';
      } else {
        const data = await r.json();
        errEl.textContent = data.error || 'Invalid credentials';
        errEl.style.display = 'block';
      }
    } catch (err) {
      errEl.textContent = 'Connection error';
      errEl.style.display = 'block';
    }
  });
});
