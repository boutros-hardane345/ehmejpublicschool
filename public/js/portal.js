const CLASSES = ['Grade 7', 'Grade 8', 'Grade 9'];
const CLASS_CODES = { 'Grade 7': 'EB7', 'Grade 8': 'EB8', 'Grade 9': 'EB9' };

function getClassCode(c) { return CLASS_CODES[c] || ''; }

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
  document.getElementById('footerClassCode').textContent = '—';
}

function renderClassPortal(className) {
  document.getElementById('footerClassCode').textContent = getClassCode(className);
  const sn = className.replace('Grade ', '');
  document.getElementById('portalSubtitle').textContent = 'Announcements and Exercises for ' + className;
  document.getElementById('portalContent').innerHTML =
    '<div class="portal-content" id="portalColumns">' +
    '<div class="portal-section"><h2>Announcements</h2><div id="announcementsList"><p class="text-muted">Loading...</p></div></div>' +
    '<div class="portal-section"><h2>Coursework & Exercises</h2><div id="exercisesList"><p class="text-muted">Loading...</p></div></div>' +
    '</div>' +
    '<div class="portal-content" id="qaSection">' +
    '<div class="portal-section" style="grid-column:1/-1"><h2>Questions</h2>' +
    '<div id="qaForm">' +
    '<input type="text" id="studentNameInput" placeholder="Your name" style="width:100%;margin-bottom:0.5rem;padding:0.6rem 0.8rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:0.88rem">' +
    '<textarea id="questionInput" placeholder="Write your question..." rows="3" style="width:100%;margin-bottom:0.5rem;padding:0.6rem 0.8rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:0.88rem;resize:vertical"></textarea>' +
    '<button class="btn btn-primary" type="button" id="submitQuestion">Submit Question</button>' +
    '</div>' +
    '<div id="questionsList" class="content-feed"></div>' +
    '</div>' +
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
  loadQuestions();

  document.getElementById('submitQuestion').addEventListener('click', function () {
    const studentName = document.getElementById('studentNameInput').value.trim() || 'Student';
    const question = document.getElementById('questionInput').value.trim();
    if (!question) return;
    API.post('/api/questions', { studentName: studentName, className: className, question: question }).then(function () {
      document.getElementById('questionInput').value = '';
      showToast('Question submitted', 'success');
      loadQuestions();
    }).catch(function () {
      showToast('Error submitting question', 'error');
    });
  });
}

function loadQuestions() {
  const el = document.getElementById('questionsList');
  if (!el) return;
  const params = new URLSearchParams(window.location.search);
  const classNameMatch = window.location.pathname.match(/^\/portal\/grade-(7|8|9)\/?$/);
  const className = params.get('class') || (classNameMatch ? 'Grade ' + classNameMatch[1] : '');
  if (!className) return;
  API.get('/api/questions?className=' + encodeURIComponent(className)).then(function (questions) {
    if (!questions || questions.length === 0) {
      el.innerHTML = '<p class="empty-state">No questions yet.</p>';
      return;
    }
    el.innerHTML = '<div class="content-feed">' +
      questions.map(function (q) {
        return '<div class="feed-item">' +
          '<div class="feed-meta"><span class="badge badge-neutral">' + escapeHtml(q.studentName) + '</span><span>' + formatDate(q.createdAt) + '</span></div>' +
          '<p>' + escapeHtml(q.question) + '</p>' +
          '</div>';
      }).join('') +
      '</div>';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }).catch(function () {
    el.innerHTML = '<p class="empty-state">Could not load questions.</p>';
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
