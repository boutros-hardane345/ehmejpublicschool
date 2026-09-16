function loadQuote() {
  API.get('/api/quote').then(q => {
    document.getElementById('sideQuote').textContent = '\u201C' + q.text + '\u201D \u2014 ' + q.author;
  });
}

async function loadDashboard() {
  try {
    const [yearData, students, grades] = await Promise.all([
      API.get('/api/academic-year'),
      API.get('/api/students'),
      API.get('/api/grades')
    ]);

    document.getElementById('academicYear').textContent = 'Academic Year ' + yearData.year;
    document.getElementById('totalStudents').textContent = students.students.length;

    const allG = grades.grades || [];
    const classList = ['Grade 7', 'Grade 8', 'Grade 9'];
    const semesters = [1, 2, 3, 4, 5, 6];
    const semLabels = { 1: 'S1', 2: 'S2', 3: 'Mid', 4: 'S3', 5: 'S4', 6: 'Final' };

    let totalAvgSum = 0;
    let totalAvgCount = 0;

    const rows = classList.map(cn => {
      const clsStudents = students.students.filter(s => s.className === cn);
      const clsIds = clsStudents.map(s => s._id);
      const clsGrades = allG.filter(g => clsIds.some(id => id === g.studentId || id.toString() === g.studentId.toString()));

      const semAvgs = semesters.map(sem => {
        const sg = clsGrades.filter(g => g.semester === sem);
        const avg = sg.length ? Math.round(sg.reduce((a, g) => a + final20(g), 0) / sg.length * 10) / 10 : 0;
        if (avg > 0) { totalAvgSum += avg; totalAvgCount++; }
        return avg;
      });

      return '<tr>' +
        '<td><span class="badge badge-neutral">' + cn + '</span></td>' +
        '<td><strong>' + clsStudents.length + '</strong></td>' +
        semAvgs.map(a =>
          '<td class="' + (a >= 10 ? 'text-pass' : a >= 8 ? 'text-border' : 'text-fail') + '">' + a.toFixed(1) + '</td>'
        ).join('') +
        '</tr>';
    });

    if (rows.length === 0 || rows.every(r => r.includes('0 students'))) {
      document.getElementById('avgTableBody').innerHTML = '<tr><td colspan="8" class="text-center text-muted">No students enrolled.</td></tr>';
    } else {
      document.getElementById('avgTableBody').innerHTML = rows.join('');
    }

    const overall = totalAvgCount ? (totalAvgSum / totalAvgCount).toFixed(1) : '0.0';
    document.getElementById('overallAvg').textContent = overall;

  } catch (err) {
    document.getElementById('avgTableBody').innerHTML = '<tr><td colspan="8" class="text-center text-muted">Error loading data.</td></tr>';
  }

  loadQuestions();
}

async function loadQuestions() {
  try {
    const questions = await API.get('/api/questions');
    const feed = document.getElementById('questionsFeed');
    if (!questions || questions.length === 0) {
      feed.innerHTML = '<p class="empty-state">No questions yet.</p>';
      return;
    }
    feed.innerHTML = questions.map(q =>
      '<div class="feed-item">' +
      '<div class="feed-meta"><span class="badge badge-neutral">' + escapeHtml(q.className) + '</span><span>' + formatDate(q.createdAt) + '</span></div>' +
      '<h4>' + escapeHtml(q.studentName) + '</h4>' +
      '<p>' + escapeHtml(q.question) + '</p>' +
      '</div>'
    ).join('');
  } catch (e) {
    document.getElementById('questionsFeed').innerHTML = '<p class="empty-state">Could not load questions.</p>';
  }
}

function submitTeacherQuestion() {
  const studentName = document.getElementById('teacherStudentName').value.trim();
  const className = document.getElementById('teacherClassName').value.trim();
  const question = document.getElementById('teacherQuestionInput').value.trim();
  if (!studentName) return showToast('Student name is required', 'error');
  if (!isValidClassName(className)) return showToast('Valid class is required', 'error');
  if (!question) return showToast('Question is required', 'error');
  API.post('/api/questions', { studentName, className, question }).then(function () {
    document.getElementById('teacherStudentName').value = '';
    document.getElementById('teacherClassName').value = '';
    document.getElementById('teacherQuestionInput').value = '';
    showToast('Question submitted', 'success');
    loadQuestions();
  }).catch(function () {
    showToast('Error submitting question', 'error');
  });
}

document.addEventListener('DOMContentLoaded', function () {
  var submitBtn = document.getElementById('submitTeacherQuestion');
  if (submitBtn) submitBtn.addEventListener('click', submitTeacherQuestion);
  loadQuote();
  loadDashboard();
});

function isValidClassName(c) { return ['Grade 7', 'Grade 8', 'Grade 9'].includes(c); }

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
  t._hide = setTimeout(function () { t.style.display = 'none'; }, 3000);
}

function final20(g) {
  return typeof g.final20 === 'number' && (g.final20 !== 0 || !g.final60 || g.rawTotal <= 20) ? g.final20 : ((g.final60 || 0) / 3);
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
