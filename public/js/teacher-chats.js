let allThreads = [];
let openId = null;

function lastSeenKey(id) { return 'chat_seen_' + id; }
function getLastSeen(id) { return parseInt(localStorage.getItem(lastSeenKey(id)) || '0', 10); }
function markSeen(id, ts) { localStorage.setItem(lastSeenKey(id), String(ts || Date.now())); }
function isUnread(t) {
  if (!t || !t.messages || t.messages.length === 0) return false;
  const last = t.messages[t.messages.length - 1];
  if (last.senderRole !== 'student') return false;
  return new Date(t.updatedAt).getTime() > getLastSeen(t._id);
}

async function init() {
  loadQuote();
  const cls = await API.get('/api/classes');
  document.getElementById('ccf').innerHTML = '<option value="all">All Classes</option>' + cls.map(c => '<option value="' + c + '">' + c + '</option>').join('');
  await loadThreads();
  document.getElementById('ccf').addEventListener('change', renderList);
  document.getElementById('csearch').addEventListener('input', renderList);
  document.getElementById('unreadOnly').addEventListener('change', renderList);
  document.getElementById('chatRefreshBtn').addEventListener('click', loadThreads);
  document.getElementById('replyBtn').addEventListener('click', sendReply);
  document.getElementById('hideBtn').addEventListener('click', toggleHide);
  document.getElementById('delThreadBtn').addEventListener('click', deleteThread);
}

async function loadThreads() {
  try {
    const cls = document.getElementById('ccf').value || 'all';
    const q = cls !== 'all' ? '?className=' + encodeURIComponent(cls) : '';
    allThreads = await API.get('/api/threads' + q);
    renderList();
  } catch (e) {
    document.getElementById('threadList').innerHTML = '<p class="empty-state">Could not load chats. Session may have expired — please log in again.</p>';
  }
}

function filteredThreads() {
  const q = (document.getElementById('csearch').value || '').toLowerCase();
  const unreadOnly = document.getElementById('unreadOnly').checked;
  return (allThreads || [])
    .filter(t => !q || (t.studentName || '').toLowerCase().includes(q))
    .filter(t => !unreadOnly || isUnread(t))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function renderList() {
  const list = filteredThreads();
  const unreadN = (allThreads || []).filter(isUnread).length;
  document.getElementById('threadCount').textContent = list.length + ' threads • ' + unreadN + ' unread';
  const el = document.getElementById('threadList');
  if (list.length === 0) { el.innerHTML = '<p class="empty-state">No threads.</p>'; return; }
  el.innerHTML = list.map(t => {
    const last = (t.messages && t.messages[t.messages.length - 1]) || null;
    const preview = last ? escapeHtml(last.text).slice(0, 60) : 'No messages yet';
    const unread = isUnread(t);
    return '<div class="feed-item" data-id="' + t._id + '" onclick="openThread(\'' + t._id + '\')" style="cursor:pointer;' + (t._id === openId ? 'border-color:var(--accent);' : '') + (unread ? 'background:rgba(196,149,106,.08);' : '') + '">' +
      '<div class="feed-meta"><span class="badge badge-neutral">' + escapeHtml(t.className) + '</span>' +
      (unread ? '<span class="badge">Unread</span>' : '') +
      (t.isHiddenByTeacher ? '<span class="badge">Hidden</span>' : '') +
      '<span>' + formatDate(t.updatedAt) + '</span></div>' +
      '<h4>' + escapeHtml(t.studentName) + '</h4><p>' + preview + '</p></div>';
  }).join('');
}

async function openThread(id) {
  openId = id;
  const t = allThreads.find(x => x._id === id);
  if (!t) return;
  markSeen(id, new Date(t.updatedAt).getTime());
  document.getElementById('openThreadTitle').textContent = t.studentName + ' — ' + t.className;
  const box = document.getElementById('openThread');
  const msgs = t.messages || [];
  box.innerHTML = msgs.length === 0
    ? '<p class="empty-state">No messages yet.</p>'
    : msgs.map(m => '<div class="feed-item"><div class="feed-meta"><span class="badge badge-neutral">' + escapeHtml(m.senderRole === 'teacher' ? 'Teacher' : m.senderName) + '</span><span>' + formatDate(m.createdAt) + '</span></div><p>' + escapeHtml(m.text) + '</p></div>').join('');
  document.getElementById('replyBox').style.display = '';
  document.getElementById('hideBtn').textContent = t.isHiddenByTeacher ? 'Unhide for student' : 'Hide from student';
  renderList();
}

async function sendReply() {
  if (!openId) return;
  const inp = document.getElementById('replyInput');
  const text = (inp.value || '').trim();
  if (!text) return;
  await API.post('/api/threads/' + openId + '/reply', { text });
  inp.value = '';
  showToast('Reply sent', 'success');
  await loadThreads();
  await openThread(openId);
}

async function toggleHide() {
  if (!openId) return;
  const t = allThreads.find(x => x._id === openId);
  await API.put('/api/threads/' + openId + '/hide', { hidden: !(t && t.isHiddenByTeacher) });
  showToast('Visibility updated', 'success');
  await loadThreads();
  await openThread(openId);
}

async function deleteThread() {
  if (!openId) return;
  if (!confirm('Delete this whole thread?')) return;
  await API.del('/api/threads/' + openId);
  openId = null;
  document.getElementById('openThreadTitle').textContent = 'Select a thread';
  document.getElementById('openThread').innerHTML = '<p class="empty-state">Choose a student on the left.</p>';
  document.getElementById('replyBox').style.display = 'none';
  showToast('Thread deleted', 'success');
  await loadThreads();
}

function loadQuote() {
  API.get('/api/quote').then(q => {
    document.getElementById('sideQuote').textContent = '\u201C' + q.text + '\u201D — ' + q.author;
  }).catch(() => {});
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t == null ? '' : t;
  return d.innerHTML;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

document.addEventListener('DOMContentLoaded', init);
