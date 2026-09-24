let currentAnnouncements = [];
let currentExercises = [];
let editingAnnouncementId = null;
let editingExerciseId = null;

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

function plainToHtml(t) {
  return escapeHtml(String(t == null ? '' : t)).replace(/\n/g, '<br>');
}

function getRteHtml(editorId) {
  const ed = document.getElementById(editorId);
  if (!ed) return '';
  return sanitizeRichHtml(ed.innerHTML);
}

function getRteText(editorId) {
  const ed = document.getElementById(editorId);
  return ed ? (ed.textContent || '').trim() : '';
}

function setRteHtml(editorId, html) {
  const ed = document.getElementById(editorId);
  if (!ed) return;
  const s = String(html == null ? '' : html);
  ed.innerHTML = /<[a-z][\s\S]*>/i.test(s) ? sanitizeRichHtml(s) : plainToHtml(s);
}

function clearRte(editorId) {
  const ed = document.getElementById(editorId);
  if (ed) ed.innerHTML = '';
}

function initRte(toolbarId, editorId) {
  const toolbar = document.getElementById(toolbarId);
  const editor = document.getElementById(editorId);
  if (!toolbar || !editor) return;
  toolbar.addEventListener('click', function (e) {
    const btn = e.target && e.target.closest ? e.target.closest('button[data-cmd]') : null;
    if (!btn) return;
    e.preventDefault();
    editor.focus();
    const cmd = btn.getAttribute('data-cmd');
    if (cmd === 'red') {
      document.execCommand('foreColor', false, '#dc2626');
    } else if (cmd === 'bold' || cmd === 'italic' || cmd === 'underline' || cmd === 'insertUnorderedList' || cmd === 'insertOrderedList' || cmd === 'removeFormat') {
      document.execCommand(cmd, false, null);
    }
    editor.focus();
  });
}

function init() {
  initRte('acToolbar', 'acContentEditor');
  initRte('exToolbar', 'exDescEditor');
  loadQuote();
  API.get('/api/classes').then(cls => {
    ['ccf', 'csf', 'acClass', 'exClass'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      if (id === 'csf') return;
      sel.innerHTML = '<option value="all">All Classes</option>' + cls.map(c => '<option value="' + c + '">' + c + '</option>').join('');
      if (id === 'acClass' || id === 'exClass') {
        sel.innerHTML = cls.map(c => '<option value="' + c + '">' + c + '</option>').join('');
      }
    });
    loadContent();
  });
}

async function loadContent() {
  const cls = document.getElementById('ccf').value;
  const sem = document.getElementById('csf').value;
  const params = new URLSearchParams();
  if (cls !== 'all') params.set('className', cls);
  if (sem !== 'all') params.set('semester', sem);
  try {
    const data = await API.get('/api/content?' + params.toString());
    currentAnnouncements = data.announcements || [];
    currentExercises = data.exercises || [];
    renderAnnouncements();
    renderExercises();
  } catch (e) {
    document.getElementById('announcementsFeed').innerHTML = '<p class="empty-state">Error loading content.</p>';
  }
}

function renderAnnouncements() {
  const feed = document.getElementById('announcementsFeed');
  document.getElementById('announcementCount').textContent = currentAnnouncements.length + ' found';
  if (currentAnnouncements.length === 0) {
    feed.innerHTML = '<p class="empty-state">No announcements match.</p>';
    return;
  }
  feed.innerHTML = currentAnnouncements.map(a =>
    '<div class="feed-item">' +
    '<div class="feed-meta"><span class="badge badge-neutral">' + escapeHtml(a.className) + '</span><span>' + formatDate(a.createdAt) + '</span></div>' +
    '<h4>' + escapeHtml(a.title) + '</h4>' +
    '<div class="rich-text">' + renderRichText(a.content) + '</div>' +
    '<div class="feed-actions"><button class="btn btn-secondary btn-sm" onclick="editAnnouncement(\'' + a._id + '\')">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteAnnouncement(\'' + a._id + '\')">Delete</button></div>' +
    '</div>'
  ).join('');
}

function renderExercises() {
  const feed = document.getElementById('exercisesFeed');
  document.getElementById('exerciseCount').textContent = currentExercises.length + ' found';
  if (currentExercises.length === 0) {
    feed.innerHTML = '<p class="empty-state">No exercises match.</p>';
    return;
  }
  feed.innerHTML = currentExercises.map(e =>
    '<div class="feed-item">' +
    '<div class="feed-meta"><span class="badge badge-neutral">' + escapeHtml(e.className) + '</span><span>' + formatDate(e.createdAt) + '</span></div>' +
    '<h4>' + escapeHtml(e.title) + '</h4>' +
    '<div class="rich-text">' + renderRichText(e.description || 'No description') + '</div>' +
    '<div class="feed-meta">' +
    (e.semester ? '<span>Semester ' + e.semester + '</span>' : '') +
    (e.fileUrl ? '<a href="/download/' + e._id + '" target="_blank">Open file</a>' : '') +
    '</div>' +
    '<div class="feed-actions"><button class="btn btn-secondary btn-sm" onclick="editExercise(\'' + e._id + '\')">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteExercise(\'' + e._id + '\')">Delete</button></div>' +
    '</div>'
  ).join('');
}

async function deleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;
  await API.del('/api/announcements/' + id);
  showToast('Announcement deleted', 'success');
  loadContent();
}

async function editAnnouncement(id) {
  const a = currentAnnouncements.find(x => x._id === id);
  if (!a) return;
  document.getElementById('acClass').value = a.className;
  document.getElementById('acTitle').value = a.title;
  setRteHtml('acContentEditor', a.content);
  editingAnnouncementId = id;
  const btn = document.querySelector('#announcementForm button[type="submit"]');
  if (btn) btn.textContent = 'Update';
  ensureCancelButton('announcementForm', cancelAnnouncementEdit);
  document.getElementById('announcementForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('acContentEditor').focus();
}

function cancelAnnouncementEdit() {
  editingAnnouncementId = null;
  document.getElementById('announcementForm').reset();
  clearRte('acContentEditor');
  const btn = document.querySelector('#announcementForm button[type="submit"]');
  if (btn) btn.textContent = 'Publish';
  removeCancelButton('announcementForm');
}

function ensureCancelButton(formId, onCancel) {
  const form = document.getElementById(formId);
  if (!form || form.querySelector('.js-cancel-edit')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-secondary js-cancel-edit';
  btn.style.marginLeft = '.5rem';
  btn.textContent = 'Cancel';
  btn.addEventListener('click', onCancel);
  form.querySelector('button[type="submit"]').after(btn);
}

function removeCancelButton(formId) {
  const form = document.getElementById(formId);
  const btn = form ? form.querySelector('.js-cancel-edit') : null;
  if (btn) btn.remove();
}

async function deleteExercise(id) {
  if (!confirm('Delete this exercise?')) return;
  await API.del('/api/exercises/' + id);
  showToast('Exercise deleted', 'success');
  loadContent();
}

async function editExercise(id) {
  const e = currentExercises.find(x => x._id === id);
  if (!e) return;
  document.getElementById('exClass').value = e.className;
  document.getElementById('exTitle').value = e.title;
  setRteHtml('exDescEditor', e.description || '');
  document.getElementById('exSem').value = e.semester ? String(e.semester) : '';
  editingExerciseId = id;
  const btn = document.querySelector('#exerciseForm button[type="submit"]');
  if (btn) btn.textContent = 'Update';
  ensureCancelButton('exerciseForm', cancelExerciseEdit);
  document.getElementById('exerciseForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  document.getElementById('exDescEditor').focus();
  showToast('Editing exercise — attached file stays unless you pick a new one', 'success');
}

function cancelExerciseEdit() {
  editingExerciseId = null;
  document.getElementById('exerciseForm').reset();
  clearRte('exDescEditor');
  const btn = document.querySelector('#exerciseForm button[type="submit"]');
  if (btn) btn.textContent = 'Upload';
  removeCancelButton('exerciseForm');
}

document.getElementById('announcementForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const contentHtml = getRteHtml('acContentEditor');
  if (!getRteText('acContentEditor')) { showToast('Message is required', 'error'); return; }
  const btn = this.querySelector('button[type="submit"]');
  const wasEditing = !!editingAnnouncementId;
  btn.textContent = wasEditing ? 'Updating...' : 'Publishing...';
  try {
    if (editingAnnouncementId) {
      await API.put('/api/announcements/' + editingAnnouncementId, {
        className: document.getElementById('acClass').value,
        title: document.getElementById('acTitle').value.trim(),
        content: contentHtml
      });
      showToast('Announcement updated', 'success');
    } else {
      await API.post('/api/announcements', {
        className: document.getElementById('acClass').value,
        title: document.getElementById('acTitle').value,
        content: contentHtml
      });
      showToast('Announcement published', 'success');
    }
    cancelAnnouncementEdit();
    loadContent();
  } catch (e) {
    showToast('Error publishing', 'error');
  }
  btn.textContent = 'Publish';
});

document.getElementById('exerciseForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const btn = this.querySelector('button[type="submit"]');
  const descriptionHtml = getRteHtml('exDescEditor');
  if (editingExerciseId) {
    btn.textContent = 'Updating...';
    try {
      const formData = new FormData();
      formData.append('className', document.getElementById('exClass').value);
      formData.append('title', document.getElementById('exTitle').value.trim());
      formData.append('description', descriptionHtml);
      formData.append('semester', document.getElementById('exSem').value);
      const file = document.getElementById('exFile').files[0];
      if (file) formData.append('file', file);
      const r = await fetch('/api/exercises/' + editingExerciseId, { method: 'PUT', body: formData });
      if (!r.ok) throw new Error('Update failed');
      showToast(file ? 'Exercise + file updated (persistent)' : 'Exercise updated', 'success');
      cancelExerciseEdit();
      loadContent();
    } catch (e) {
      showToast('Error updating exercise', 'error');
    }
    btn.textContent = 'Upload';
    return;
  }
  btn.textContent = 'Uploading...';
  const formData = new FormData();
  formData.append('className', document.getElementById('exClass').value);
  formData.append('title', document.getElementById('exTitle').value);
  formData.append('description', descriptionHtml);
  formData.append('semester', document.getElementById('exSem').value);
  formData.append('file', document.getElementById('exFile').files[0]);
  try {
    const r = await fetch('/api/exercises', { method: 'POST', body: formData });
    if (!r.ok) throw new Error('Upload failed');
    showToast('Exercise uploaded', 'success');
    this.reset();
    clearRte('exDescEditor');
    loadContent();
  } catch (e) {
    showToast('Error uploading', 'error');
  }
  btn.textContent = 'Upload';
});

document.getElementById('contentFilterBtn').addEventListener('click', loadContent);

function loadQuote() {
  API.get('/api/quote').then(q => {
    document.getElementById('sideQuote').textContent = '\u201C' + q.text + '\u201D \u2014 ' + q.author;
  });
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

init();
