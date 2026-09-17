const CLASSES = ['Grade 7', 'Grade 8', 'Grade 9'];
const CLASS_CODES = { 'Grade 7': 'EB7', 'Grade 8': 'EB8', 'Grade 9': 'EB9' };

function getClassCode(c) { return CLASS_CODES[c] || ''; }

function loadQuote() {
  API.get('/api/quote').then(q => {
    document.getElementById('quoteText').textContent = '"' + q.text + '"';
    document.getElementById('quoteAuthor').textContent = q.author;
  }).catch(() => {});
}

function renderDirectory() {
  document.getElementById('portalSubtitle').textContent = 'Select Your Class';
  document.getElementById('portalContent').innerHTML =
    '<div class="portal-directory">' +
    CLASSES.map(c =>
      '<a href="/portal/' + c.toLowerCase().replace(' ', '-') + '">' + c + '</a>'
    ).join('') +
    '</div><p class="text-muted" style="text-align:center;margin-top:1rem"><a href="/portal/login">Student login</a></p>';
  document.getElementById('footerClassCode').textContent = '—';
}

async function renderClassPortal(className) {
  document.getElementById('footerClassCode').textContent = getClassCode(className);
  // Verify session: must be logged student of this grade, or teacher
  let me = null;
  try {
    const r = await fetch('/api/portal/me');
    me = await r.json();
  } catch (e) { me = null; }
  if (!me || (!me.loggedIn)) {
    // Teacher session? try a teacher-only ping
    try {
      await API.get('/api/students?className=' + encodeURIComponent(className));
      // teacher OK — render full portal without My DS/chat gate
      return renderPortalBody(className, null);
    } catch (e) {
      document.getElementById('portalSubtitle').textContent = 'Login required';
      document.getElementById('portalContent').innerHTML =
        '<p class="empty-state">Please <a href="/portal/login">log in</a> to view ' + escapeHtml(className) + '.</p>';
      return;
    }
  }
  if (me.className !== className) {
    window.location.href = '/portal/' + me.className.toLowerCase().replace(' ', '-');
    return;
  }
  renderPortalBody(className, me);
}

function renderPortalBody(className, me) {
  document.getElementById('portalSubtitle').textContent = 'Announcements and Exercises for ' + className + (me ? ' — ' + me.name : '');
  document.getElementById('portalContent').innerHTML =
    '<div class="portal-content" id="portalColumns">' +
    '<div class="portal-section"><h2>Announcements</h2><div id="announcementsList"><p class="text-muted">Loading...</p></div></div>' +
    '<div class="portal-section"><h2>Coursework & Exercises</h2><div id="exercisesList"><p class="text-muted">Loading...</p></div></div>' +
    '</div>' +
    (me ? '<div class="portal-content"><div class="portal-section" style="grid-column:1/-1"><h2>My DS Grades (/20)</h2><div id="myDsList"><p class="text-muted">Loading...</p></div><p><a href="/portal/logout" class="text-muted">Logout</a></p></div></div>' : '') +
    (me ? '<div class="portal-content"><div class="portal-section" style="grid-column:1/-1"><h2>My Chat with Teacher</h2><div id="myThread" class="content-feed"><p class="text-muted">Loading...</p></div><div style="display:flex;gap:.5rem;margin-top:.5rem"><input type="text" id="chatInput" placeholder="Write a message..." style="flex:1;padding:.6rem .8rem;border:1.5px solid var(--border);border-radius:var(--radius-sm)"><button class="btn btn-primary" type="button" id="sendChat">Send</button></div></div></div>' : '') +
    '<div class="portal-content" id="qaSection">' +
    '<div class="portal-section" style="grid-column:1/-1"><h2>Questions</h2>' +
    '<div id="qaForm">' +
    '<input type="text" id="studentNameInput" placeholder="Your name" value="' + escapeHtml(me ? me.name : '') + '" style="width:100%;margin-bottom:0.5rem;padding:0.6rem 0.8rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:0.88rem">' +
    '<textarea id="questionInput" placeholder="Write your question..." rows="3" style="width:100%;margin-bottom:0.5rem;padding:0.6rem 0.8rem;border:1.5px solid var(--border);border-radius:var(--radius-sm);font-size:0.88rem;resize:vertical"></textarea>' +
    '<button class="btn btn-primary" type="button" id="submitQuestion">Submit Question</button>' +
    '</div>' +
    '<div id="questionsList" class="content-feed"></div>' +
    '</div>' +
    '</div>';

  API.get('/api/content?className=' + encodeURIComponent(className)).then(data => {
    renderAnnouncements(data.announcements);
    renderExercises(data.exercises);
  }).catch(() => {
    document.getElementById('announcementsList').innerHTML = '<p class="empty-state">Could not load content.</p>';
    document.getElementById('exercisesList').innerHTML = '';
  });
  loadQuestions();
  if (me) { loadMyDs(); loadMyThread(); }

  document.getElementById('submitQuestion').addEventListener('click', function () {
    const studentName = document.getElementById('studentNameInput').value.trim() || (me ? me.name : 'Student');
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
  const sendBtn = document.getElementById('sendChat');
  if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
}

async function loadMyDs() {
  const el = document.getElementById('myDsList');
  if (!el) return;
  try {
    const r = await fetch('/api/portal/my-ds');
    if (!r.ok) throw new Error();
    const data = await r.json();
    if (!data.ds || data.ds.length === 0) { el.innerHTML = '<p class="empty-state">No DS yet.</p>'; return; }
    el.innerHTML = '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' +
      data.ds.map((v, i) => '<span class="badge badge-neutral" title="DS' + (i + 1) + '">DS' + (i + 1) + ': ' + (v === null ? '—' : Number(v).toFixed(1)) + '</span>').join('') +
      '</div><p class="text-muted">Only DS grades are shown. ' + data.quota + ' DS for the year, filled over time.</p>';
  } catch (e) {
    el.innerHTML = '<p class="empty-state">Could not load DS grades.</p>';
  }
}

async function loadMyThread() {
  const el = document.getElementById('myThread');
  if (!el) return;
  try {
    const r = await fetch('/api/portal/my-thread');
    const data = await r.json();
    const msgs = (data.thread && data.thread.messages) || [];
    if (msgs.length === 0) { el.innerHTML = '<p class="empty-state">No messages yet. Say hello to your teacher.</p>'; return; }
    el.innerHTML = msgs.map(m =>
      '<div class="feed-item"><div class="feed-meta"><span class="badge badge-neutral">' + escapeHtml(m.senderRole === 'teacher' ? 'Teacher' : m.senderName) + '</span><span>' + formatDate(m.createdAt) + '</span></div><p>' + escapeHtml(m.text) + '</p></div>'
    ).join('');
  } catch (e) {
    el.innerHTML = '<p class="empty-state">Could not load chat.</p>';
  }
}

async function sendChatMessage() {
  const inp = document.getElementById('chatInput');
  const text = (inp.value || '').trim();
  if (!text) return;
  try {
    const r = await fetch('/api/portal/my-thread/message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
    if (!r.ok) throw new Error();
    inp.value = '';
    showToast('Sent', 'success');
    loadMyThread();
  } catch (e) {
    showToast('Error sending', 'error');
  }
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
          (q.answer ? '<p style="margin-top:.4rem;border-left:3px solid var(--border);padding-left:.6rem"><strong>Teacher:</strong> ' + escapeHtml(q.answer) + '</p>' : '') +
          '</div>';
      }).join('') +
      '</div>';
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
