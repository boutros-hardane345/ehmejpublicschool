let allStudents = [];
let allGrades = [];

function init() {
  loadQuote();
  API.get('/api/classes').then(cls => {
    populateSelect('ycf', cls);
  });
  API.get('/api/academic-year').then(year => {
    const ySel = document.getElementById('yyf');
    ySel.innerHTML = '<option value="' + year.year + '">' + year.year + '</option>';
  });
  loadResults();
}

function populateSelect(id, items) {
  const sel = document.getElementById(id);
  sel.innerHTML = '<option value="all">All</option>' + items.map(v => '<option value="' + v + '">' + v + '</option>').join('');
}

async function loadResults() {
  const cls = document.getElementById('ycf').value || 'all';
  const yr = document.getElementById('yyf').value || 'all';
  const statusFilter = document.getElementById('ysf').value || 'all';

  const params = new URLSearchParams();
  if (cls !== 'all') params.set('className', cls);
  if (yr !== 'all') params.set('academicYear', yr);

  try {
    const data = await API.get('/api/students?' + params.toString());
    allStudents = data.students || [];
    const ids = allStudents.map(s => s._id);
    const gradeRes = await fetch('/api/grades?' + new URLSearchParams({ academicYear: yr }));
    allGrades = (await gradeRes.json()).grades || [];
    renderResults(statusFilter);
  } catch (e) {
    document.getElementById('yearResultsBody').innerHTML = '<tr><td colspan="11" class="text-center text-muted">Error loading results.</td></tr>';
  }
}

function renderResults(statusFilter) {
  const semesters = [1, 2, 3, 4, 5, 6];
  const semLabels = ['S1', 'S2', 'Mid', 'S3', 'S4', 'Final'];

  const results = allStudents.map(student => {
    const scores = semesters.map(sem => {
      const g = allGrades.find(gr =>
        (gr.studentId === student._id || gr.studentId.toString() === student._id.toString()) && gr.semester === sem
      );
      return g ? final20(g) : 0;
    });
    const avg = scores.reduce((a, b) => a + b, 0) / 6;
    const statusKey = avg >= 10 ? 'pass' : avg >= 8 ? 'border' : 'fail';
    return { student, scores, avg, statusKey };
  });

  let filtered = results;
  if (statusFilter !== 'all') {
    filtered = results.filter(r => r.statusKey === statusFilter);
  }

  const summary = {
    total: filtered.length,
    pass: filtered.filter(r => r.statusKey === 'pass').length,
    border: filtered.filter(r => r.statusKey === 'border').length,
    fail: filtered.filter(r => r.statusKey === 'fail').length
  };

  document.getElementById('yrTotal').textContent = summary.total;
  document.getElementById('yrPass').textContent = summary.pass;
  document.getElementById('yrBorder').textContent = summary.border;
  document.getElementById('yrFail').textContent = summary.fail;

  const tbody = document.getElementById('yearResultsBody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">No results found.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const statusClass = r.statusKey === 'pass' ? 'text-pass' : r.statusKey === 'border' ? 'text-border' : 'text-fail';
    const statusLabel = r.statusKey === 'pass' ? 'Passing' : r.statusKey === 'border' ? 'Borderline' : 'Failing';
    return '<tr>' +
      '<td>' + escapeHtml(r.student.name) + '</td>' +
      '<td><span class="badge badge-neutral">' + escapeHtml(r.student.className) + '</span></td>' +
      '<td>' + (r.student.academicYear || 'Not set') + '</td>' +
      r.scores.map(s => '<td>' + s.toFixed(1) + '</td>').join('') +
      '<td class="' + statusClass + '">' + r.avg.toFixed(1) + '</td>' +
      '<td><span class="status-dot ' + r.statusKey + '"></span>' + statusLabel + '</td>' +
      '</tr>';
  }).join('');
}

document.getElementById('yearFilterBtn').addEventListener('click', function () {
  loadResults();
});

document.getElementById('exportYearPdf').addEventListener('click', function () {
  const cls = document.getElementById('ycf').value;
  const yr = document.getElementById('yyf').value;
  const params = new URLSearchParams({ class: cls, year: yr });
  window.location.href = '/teacher/export-year-pdf?' + params.toString();
});

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

function final20(g) {
  return typeof g.final20 === 'number' && (g.final20 !== 0 || !g.final60 || g.rawTotal <= 20) ? g.final20 : ((g.final60 || 0) / 3);
}

init();
