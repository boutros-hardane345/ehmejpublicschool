const API = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async post(url, data) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async put(url, data) {
    const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async del(url) {
    const r = await fetch(url, { method: 'DELETE' });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }
};

function showToast(msg, isError) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.style.background = isError ? 'linear-gradient(135deg,#c0392b,#e74c3c)' : 'linear-gradient(135deg,#1f9d55,#27ae60)';
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 3000);
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

async function loadDailyQuote() {
  try {
    const q = await API.get('/api/quote');
    const el = document.getElementById('sidebarQuote');
    if (el) el.innerHTML = `&ldquo;${q.text}&rdquo; &mdash; ${q.author}`;
  } catch(e) {}
}

document.addEventListener('DOMContentLoaded', () => {
  const sb = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  const overlay = document.getElementById('sidebarOverlay');
  if (toggle && sb) {
    toggle.addEventListener('click', () => {
      sb.classList.toggle('open');
      toggle.classList.toggle('shifted');
    });
    if (overlay) overlay.addEventListener('click', () => {
      sb.classList.remove('open');
      toggle.classList.remove('shifted');
    });
  }
  for (const link of document.querySelectorAll('.sidebar-nav a')) {
    if (link.href.replace(/\/$/, '') === window.location.href.replace(/\/$/, '')) {
      link.classList.add('active');
    }
  }
  loadDailyQuote();
});
