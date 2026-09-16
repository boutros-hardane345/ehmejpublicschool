const API = {
  async get(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error('GET ' + url + ' failed');
    return r.json();
  },
  async post(url, body) {
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error('POST ' + url + ' failed');
    return r.json();
  },
  async put(url, body) {
    const opts = { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    const r = await fetch(url, opts);
    if (!r.ok) throw new Error('PUT ' + url + ' failed');
    return r.json();
  },
  async del(url) {
    const r = await fetch(url, { method: 'DELETE' });
    if (!r.ok) throw new Error('DELETE ' + url + ' failed');
    return r.json();
  }
};

function showToast(msg, type) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast ' + (type || '');
  t.style.display = 'block';
  clearTimeout(t._hide);
  t._hide = setTimeout(() => { t.style.display = 'none'; }, 3000);
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getSeason() {
  return ['winter','winter','spring','spring','spring','summer','summer','summer','fall','fall','fall','winter'][new Date().getMonth()];
}

document.addEventListener('DOMContentLoaded', function () {
  document.documentElement.setAttribute('data-season', getSeason());
});