const CLASSES = ['Grade 7', 'Grade 8', 'Grade 9'];

function loadQuote() {
  API.get('/api/quote').then(q => {
    document.getElementById('quoteText').textContent = '"' + q.text + '"';
    document.getElementById('quoteAuthor').textContent = q.author;
  });
}

function renderDirectory() {
  document.getElementById('portalSubtitle').textContent = 'Select Your Class';
  document.getElementById('portalContent').innerHTML =
    '<div class="portal-directory">' +
    CLASSES.map(c =>
      '<a href="/portal/' + c.toLowerCase().replace(' ', '-') + '">' + c + '</a>'
    ).join('') +
    '</div>';
}

function renderClassPortal(className) {
  const sn = className.replace('Grade ', '');
  document.getElementById('portalSubtitle').textContent = 'Announcements and Exercises for ' + className;
  document.getElementById('portalContent').innerHTML =
    '<div class="portal-content" id="portalColumns">' +
    '<div class="portal-section"><h2>Announcements</h2><div id="announcementsList"><p class="text-muted">Loading...</p></div></div>' +
    '<div class="portal-section"><h2>Coursework & Exercises</h2><div id="exercisesList"><p class="text-muted">Loading...</p></div></div>' +
    '</div>';

  const params = new URLSearchParams(window.location.search);
  let url = '/api/content?className=' + encodeURIComponent(className);
  API.get(url).then(data => {
    renderAnnouncements(data.announcements);
    renderExercises(data.exercises);
  }).catch(() => {
    document.getElementById('announcementsList').innerHTML = '<p class="empty-state">Could not load content.</p>';
    document.getElementById('exercisesList').innerHTML = '';
  });
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
      '<p>' + escapeHtml(a.content) + '</p>' +
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
      '<p>' + escapeHtml(e.description || 'No description') + '</p>' +
      '<div class="feed-meta">' +
      (e.semester ? '<span>Semester ' + e.semester + '</span>' : '') +
      '<span>' + formatDate(e.createdAt) + '</span>' +
      '</div>' +
      (e.fileUrl ? '<a href="/download/' + e._id + '" class="download" target="_blank">Download file</a>' : '') +
      '</div>'
    ).join('') +
    '</div>';
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

const params = new URLSearchParams(window.location.search);
const slugMatch = /^\/portal\/grade-(7|8|9)$/.exec(window.location.pathname);
const selectedClass = slugMatch ? 'Grade ' + slugMatch[1] : params.get('class');

loadQuote();
if (selectedClass && CLASSES.includes(selectedClass)) {
  renderClassPortal(selectedClass);
} else {
  renderDirectory();
}
