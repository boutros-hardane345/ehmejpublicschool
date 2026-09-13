let currentAnnouncements = [];
let currentExercises = [];

function init() {
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
    '<p>' + escapeHtml(a.content) + '</p>' +
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
    '<p>' + escapeHtml(e.description || 'No description') + '</p>' +
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
  const title = prompt('Announcement title', a.title);
  if (title === null) return;
  const content = prompt('Announcement message', a.content);
  if (content === null) return;
  const className = prompt('Class: Grade 7, Grade 8, or Grade 9', a.className);
  if (className === null) return;
  try {
    await API.put('/api/announcements/' + id, { className: className.trim(), title: title.trim(), content: content.trim() });
    showToast('Announcement updated', 'success');
    loadContent();
  } catch (e) {
    showToast('Error updating announcement', 'error');
  }
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
  const title = prompt('Exercise title', e.title);
  if (title === null) return;
  const description = prompt('Exercise description', e.description || '');
  if (description === null) return;
  const semester = prompt('Semester 1-4, or blank', e.semester || '');
  if (semester === null) return;
  const className = prompt('Class: Grade 7, Grade 8, or Grade 9', e.className);
  if (className === null) return;
  try {
    await API.put('/api/exercises/' + id, { className: className.trim(), title: title.trim(), description: description.trim(), semester: semester.trim() });
    showToast('Exercise updated', 'success');
    loadContent();
  } catch (err) {
    showToast('Error updating exercise', 'error');
  }
}

document.getElementById('announcementForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const btn = this.querySelector('button');
  btn.textContent = 'Publishing...';
  try {
    await API.post('/api/announcements', {
      className: document.getElementById('acClass').value,
      title: document.getElementById('acTitle').value,
      content: document.getElementById('acContent').value
    });
    showToast('Announcement published', 'success');
    this.reset();
    loadContent();
  } catch (e) {
    showToast('Error publishing', 'error');
  }
  btn.textContent = 'Publish';
});

document.getElementById('exerciseForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const btn = this.querySelector('button');
  btn.textContent = 'Uploading...';
  const formData = new FormData();
  formData.append('className', document.getElementById('exClass').value);
  formData.append('title', document.getElementById('exTitle').value);
  formData.append('description', document.getElementById('exDesc').value);
  formData.append('semester', document.getElementById('exSem').value);
  formData.append('file', document.getElementById('exFile').files[0]);
  try {
    const r = await fetch('/api/exercises', { method: 'POST', body: formData });
    if (!r.ok) throw new Error('Upload failed');
    showToast('Exercise uploaded', 'success');
    this.reset();
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
