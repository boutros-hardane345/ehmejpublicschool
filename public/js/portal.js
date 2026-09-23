const CLASSES = ['Grade 7', 'Grade 8', 'Grade 9'];
const CLASS_CODES = { 'Grade 7': 'EB7', 'Grade 8': 'EB8', 'Grade 9': 'EB9' };

function getClassCode(c) { return CLASS_CODES[c] || ''; }

// Reliable logout: destroy server session via POST, drop local state,
// then replace history so Back never restores the old portal.
// Fixes "logout leaves page on portal" and sibling1 -> sibling2 switch.
async function doLogout(e) {
  if (e) e.preventDefault();
  try {
    await fetch('/api/logout', { method: 'POST', cache: 'no-store', credentials: 'same-origin' });
  } catch (err) {
    try { await fetch('/portal/logout', { cache: 'no-store', credentials: 'same-origin', redirect: 'manual' }); } catch (e2) {}
  }
  try { sessionStorage.clear(); } catch (err) {}
  try { localStorage.clear(); } catch (err) {}
  window.location.replace('/login?loggedout=1');
}

document.addEventListener('click', function (e) {
  const t = e.target && e.target.closest ? e.target.closest('.js-logout') : null;
  if (t) doLogout(e);
});

// bfcache guard: if user presses Back after logout, force login page.
window.addEventListener('pageshow', async function (e) {
  if (!e.persisted) return;
  try {
    const r = await fetch('/api/portal/me', { cache: 'no-store', credentials: 'same-origin' });
    const me = await r.json();
    if (!me || !me.loggedIn) window.location.replace('/login?loggedout=1');
  } catch (err) {}
});

function loadQuote() {
  API.get('/api/quote').then(q => {
    document.getElementById('quoteText').textContent = '"' + q.text + '"';
    document.getElementById('quoteAuthor').textContent = q.author;
  }).catch(() => {
    document.getElementById('quoteText').textContent = '';
  });
}

function renderDirectory() {
  window.location.href = '/login';
}

function apiErrorMessage(e, fallback) {
  const m = String((e && e.message) || '');
  if (m.includes('401')) return 'Session expired — please <a href="/login">log in again</a>.';
  if (m.includes('403')) return 'Restricted to your own grade.';
  return fallback;
}

async function renderClassPortal(className) {
  document.getElementById('footerClassCode').textContent = getClassCode(className);
  let me = null;
  try {
    const r = await fetch('/api/portal/me', { cache: 'no-store', credentials: 'same-origin' });
    me = await r.json();
  } catch (e) { me = null; }
  if (!me || !me.loggedIn) {
    // Teacher session? try a teacher-only ping
    try {
      await API.get('/api/students?className=' + encodeURIComponent(className));
      return renderPortalBody(className, { role: 'teacher', name: 'Teacher' });
    } catch (e) {
      document.getElementById('portalSubtitle').textContent = 'Login required';
      document.getElementById('portalContent').innerHTML =
        '<p class="empty-state">Please <a href="/login">log in</a> to view ' + escapeHtml(className) + '.</p>';
      return;
    }
  }
  if (me.role === 'teacher') return renderPortalBody(className, me);
  if (me.role === 'student') {
    if (me.className !== className) {
      window.location.href = '/portal/' + me.className.toLowerCase().replace(' ', '-');
      return;
    }
    return renderPortalBody(className, me);
  }
  document.getElementById('portalSubtitle').textContent = 'Login required';
  document.getElementById('portalContent').innerHTML =
    '<p class="empty-state">Please <a href="/login">log in</a> to view ' + escapeHtml(className) + '.</p>';
}

function renderPortalBody(className, me) {
  const isStudent = me && me.role === 'student';
  const isTeacher = me && me.role === 'teacher';
  document.getElementById('portalSubtitle').textContent = 'Announcements and Exercises for ' + className + (me && me.name ? ' — ' + me.name : '');
  document.getElementById('portalContent').innerHTML =
    '<div class="portal-logout-bar"><a href="/login?loggedout=1" class="btn btn-danger js-logout">Logout</a></div>' +
    '<div class="portal-content" id="portalColumns">' +
    '<div class="portal-section"><h2>Announcements</h2><div id="announcementsList"><p class="text-muted">Loading...</p></div></div>' +
    '<div class="portal-section"><h2>Coursework & Exercises</h2><div id="exercisesList"><p class="text-muted">Loading...</p></div></div>' +
    '</div>' +
    (isStudent ? '<div class="portal-content"><div class="portal-section" style="grid-column:1/-1"><h2>My DS Grades (/20)</h2><div id="myDsList"><p class="text-muted">Loading...</p></div></div></div>' : '') +
    (isTeacher ? '<div class="portal-content"><div class="portal-section" style="grid-column:1/-1"><p class="text-muted">Teacher preview. Manage chats in <a href="/teacher/chats">Chats</a>.</p><p style="margin-top:1rem"><a href="/login?loggedout=1" class="btn btn-danger js-logout">Logout</a></p></div></div>' : '') +
    (isStudent ? '<div class="portal-content"><div class="portal-section" style="grid-column:1/-1"><h2>My Chat with Teacher</h2><div id="myThread" class="content-feed"><p class="text-muted">Loading...</p></div><div style="display:flex;gap:.5rem;margin-top:.5rem"><input type="text" id="chatInput" placeholder="Write a message..." style="flex:1;padding:.6rem .8rem;border:1.5px solid var(--border);border-radius:var(--radius-sm)"><button class="btn btn-primary" type="button" id="sendChat">Send</button></div></div></div>' : '');

  API.get('/api/content?className=' + encodeURIComponent(className)).then(data => {
    renderAnnouncements(data.announcements);
    renderExercises(data.exercises);
  }).catch((e) => {
    document.getElementById('announcementsList').innerHTML = '<p class="empty-state">' + apiErrorMessage(e, 'Could not load content.') + '</p>';
    document.getElementById('exercisesList').innerHTML = '';
  });
  if (isStudent) { loadMyDs(); loadMyThread(); }
  const sendBtn = document.getElementById('sendChat');
  if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
}

async function loadMyDs() {
  const el = document.getElementById('myDsList');
  if (!el) return;
  try {
    const r = await fetch('/api/portal/my-ds');
    if (!r.ok) throw new Error('GET /api/portal/my-ds failed ' + r.status);
    const data = await r.json();
    if (!data.ds || data.ds.length === 0) { el.innerHTML = '<p class="empty-state">No DS yet.</p>'; return; }
    el.innerHTML = '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' +
      data.ds.map((v, i) => '<span class="badge badge-neutral" title="DS' + (i + 1) + '">DS' + (i + 1) + ': ' + (v === null ? '—' : Number(v).toFixed(1)) + '</span>').join('') +
      '</div>';
  } catch (e) {
    el.innerHTML = '<p class="empty-state">' + apiErrorMessage(e, 'Could not load DS grades.') + '</p>';
  }
}

async function loadMyThread() {
  const el = document.getElementById('myThread');
  if (!el) return;
  try {
    const r = await fetch('/api/portal/my-thread');
    if (!r.ok) throw new Error('GET /api/portal/my-thread failed ' + r.status);
    const data = await r.json();
    if (data.hidden) { el.innerHTML = '<p class="empty-state">Chat hidden by teacher.</p>'; return; }
    const msgs = (data.thread && data.thread.messages) || [];
    if (msgs.length === 0) { el.innerHTML = '<p class="empty-state">No messages yet. Say hello to your teacher.</p>'; return; }
    el.innerHTML = msgs.map(m =>
      '<div class="feed-item"><div class="feed-meta"><span class="badge badge-neutral">' + escapeHtml(m.senderRole === 'teacher' ? 'Teacher' : m.senderName) + '</span><span>' + formatDate(m.createdAt) + '</span></div><p>' + escapeHtml(m.text) + '</p></div>'
    ).join('');
  } catch (e) {
    el.innerHTML = '<p class="empty-state">' + apiErrorMessage(e, 'Could not load chat.') + '</p>';
  }
}

async function sendChatMessage() {
  const inp = document.getElementById('chatInput');
  const text = (inp.value || '').trim();
  if (!text) return;
  try {
    const r = await fetch('/api/portal/my-thread/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!r.ok) throw new Error('POST failed ' + r.status);
    inp.value = '';
    showToast('Sent', 'success');
    loadMyThread();
  } catch (e) {
    showToast(apiErrorMessage(e, 'Error sending').replace(/<[^>]*>/g, ''), 'error');
  }
}

function renderAnnouncements(list) {
  const el = document.getElementById('announcementsList');
  if (!list || list.length === 0) {
    el.innerHTML = '<p class="empty-state">No announcements available.</p>';
    return;
  }
  el.innerHTML = '<div class="content-feed">' +
    list.map(a =>
      '<div class="feed-item">' +
      '<h4>' + escapeHtml(a.title) + '</h4>' +
      '<div class="rich-text">' + renderRichText(a.content) + '</div>' +
      '<div class="feed-meta"><span>' + formatDate(a.createdAt) + '</span></div>' +
      '</div>'
    ).join('') +
    '</div>';
}

function renderExercises(list) {
  const el = document.getElementById('exercisesList');
  if (!list || list.length === 0) {
    el.innerHTML = '<p class="empty-state">No exercises available.</p>';
    return;
  }
  el.innerHTML = '<div class="content-feed">' +
    list.map(e =>
      '<div class="feed-item">' +
      '<h4>' + escapeHtml(e.title) + '</h4>' +
      '<div class="rich-text">' + renderRichText(e.description || 'No description') + '</div>' +
      '<div class="feed-meta">' +
      (e.semester ? '<span>Semester ' + e.semester + '</span>' : '') +
      '<span>' + formatDate(e.createdAt) + '</span>' +
      '</div>' +
      (e.fileUrl ? '<a href="/download/' + e._id + '" class="btn btn-primary btn-sm download-btn" target="_blank">Download file</a>' : '') +
      '</div>'
    ).join('') +
    '</div>';
}

function sanitizeRichHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html == null ? '' : html);
  const allowedTags = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, BR: 1, P: 1, UL: 1, OL: 1, LI: 1, SPAN: 1, FONT: 1, DIV: 1 };
  const walker = document.createTreeWalker(tmp, NodeFilter.SHOW_ELEMENT, null);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(function (node) {
    const tag = node.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'IFRAME' || tag === 'OBJECT' || tag === 'EMBED' || tag === 'LINK' || !allowedTags[tag]) {
      const parent = node.parentNode;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
      return;
    }
    Array.from(node.attributes || []).forEach(function (attr) {
      const name = attr.name.toLowerCase();
      const val = attr.value || '';
      if (name.startsWith('on') || val.toLowerCase().includes('javascript:')) { node.removeAttribute(attr.name); return; }
      if (tag === 'SPAN' && name === 'style') {
        const m = /color\s*:\s*(#[0-9a-f]{3,6}|rgb\([^)]*\)|red|blue|black|green|#dc2626)/i.exec(val);
        if (m) node.setAttribute('style', 'color:' + m[1]);
        else node.removeAttribute('style');
        return;
      }
      if (tag === 'FONT' && name === 'color') {
        if (!/^#[0-9a-f]{3,6}$/i.test(val) && !/^(red|blue|black|green)$/i.test(val)) node.removeAttribute('color');
        return;
      }
      if (tag === 'SPAN' && name === 'class' && val !== 'text-red') { node.removeAttribute('class'); return; }
      if (!((tag === 'SPAN' && (name === 'style' || name === 'class')) || (tag === 'FONT' && name === 'color'))) node.removeAttribute(attr.name);
    });
  });
  return tmp.innerHTML;
}

function renderRichText(t) {
  const s = String(t == null ? '' : t);
  if (/<[a-z][\s\S]*>/i.test(s)) return sanitizeRichHtml(s);
  return escapeHtml(s).replace(/\n/g, '<br>');
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t == null ? '' : t;
  return d.innerHTML;
}

const params = new URLSearchParams(window.location.search);
const slugMatch = /^\/portal\/grade-(7|8|9)\/?$/.exec(window.location.pathname);
const selectedClass = slugMatch ? 'Grade ' + slugMatch[1] : params.get('class');

loadQuote();
if (selectedClass && CLASSES.includes(selectedClass)) {
  renderClassPortal(selectedClass);
} else {
  renderDirectory();
}
