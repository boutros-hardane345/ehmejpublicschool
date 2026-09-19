let allStudents = [];
let allGrades = [];
let sortState = { key: 'name', dir: 1 };
let lastStatusFilter = 'all';

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

  document.getElementById('yearResultsBody').innerHTML =
    '<tr><td colspan="11"><div class="skel"></div><div class="skel"></div><div class="skel"></div></td></tr>';
  try {
    const data = await API.get('/api/students?' + params.toString());
    allStudents = data.students || [];
    const gradeRes = await API.get('/api/grades?' + new URLSearchParams({ className: cls, academicYear: yr }));
    allGrades = gradeRes.grades || [];
    lastStatusFilter = statusFilter;
    renderResults(statusFilter);
  } catch (e) {
    console.error(e);
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
      return g ? final60(g) : 0;
    });
    const avg = scores.reduce((a, b) => a + b, 0) / 6;
    const statusKey = avg >= 30 ? 'pass' : 'fail';
    return { student, scores, avg, statusKey };
  });

  let filtered = results;
  if (statusFilter !== 'all') {
    filtered = results.filter(r => r.statusKey === statusFilter);
  }
  const q = ((document.getElementById('yrSearch') || {}).value || '').trim().toLowerCase();
  if (q) filtered = filtered.filter(r => (r.student.name || '').toLowerCase().includes(q));
  const qc = (document.getElementById('yrClassQuick') || {}).value || 'all';
  if (qc !== 'all') filtered = filtered.filter(r => r.student.className === qc);

  const dir = sortState.dir || 1;
  filtered = filtered.slice().sort((a, b) => {
    if (sortState.key === 'avg') return (a.avg - b.avg) * dir;
    if (sortState.key === 'status') return a.statusKey.localeCompare(b.statusKey) * dir;
    return (a.student.name || '').localeCompare(b.student.name || '') * dir;
  });

  const summary = {
    total: filtered.length,
    pass: filtered.filter(r => r.statusKey === 'pass').length,
    fail: filtered.filter(r => r.statusKey === 'fail').length
  };

  animateCount('yrTotal', summary.total);
  animateCount('yrPass', summary.pass);
  const borderEl = document.getElementById('yrBorder');
  if (borderEl) borderEl.textContent = 0;
  animateCount('yrFail', summary.fail);
  const visEl = document.getElementById('yrVisibleCount');
  if (visEl) visEl.textContent = filtered.length + ' shown';

  document.querySelectorAll('.th-sort').forEach(th => {
    const k = th.getAttribute('data-sort');
    const arrow = th.querySelector('.sort-arrow');
    if (arrow) arrow.textContent = k === sortState.key ? (dir === 1 ? ' \u25B2' : ' \u25BC') : '';
    th.classList.toggle('sorted', k === sortState.key);
  });

  const tbody = document.getElementById('yearResultsBody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">No results found. Try clearing the search or filters.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const statusClass = r.statusKey === 'pass' ? 'text-pass' : 'text-fail';
    const statusLabel = r.statusKey === 'pass' ? 'Passing' : 'Failing';
    return '<tr class="row-in">' +
      '<td>' + escapeHtml(r.student.name) + '</td>' +
      '<td><span class="badge badge-neutral">' + escapeHtml(r.student.className) + '</span></td>' +
      '<td>' + (r.student.academicYear || 'Not set') + '</td>' +
      r.scores.map(s => '<td>' + s.toFixed(1) + '</td>').join('') +
      '<td class="' + statusClass + '"><strong>' + r.avg.toFixed(1) + '</strong></td>' +
      '<td><span class="status-dot ' + r.statusKey + '"></span>' + statusLabel + '</td>' +
      '</tr>';
  }).join('');
}

function animateCount(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const from = parseInt(el.textContent, 10);
  if (isNaN(from) || Math.abs(target - from) > 500) { el.textContent = target; return; }
  const start = isNaN(from) ? 0 : from;
  const t0 = performance.now(), dur = 450;
  function tick(t) {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

document.getElementById('yearFilterBtn').addEventListener('click', function () {
  loadResults();
});

const yrSearch = document.getElementById('yrSearch');
if (yrSearch) yrSearch.addEventListener('input', () => renderResults(lastStatusFilter));
const yrClassQuick = document.getElementById('yrClassQuick');
if (yrClassQuick) yrClassQuick.addEventListener('change', () => renderResults(lastStatusFilter));
const yrClear = document.getElementById('yrClearFilters');
if (yrClear) yrClear.addEventListener('click', () => {
  if (yrSearch) yrSearch.value = '';
  if (yrClassQuick) yrClassQuick.value = 'all';
  document.getElementById('ysf').value = 'all';
  loadResults();
});
document.querySelectorAll('.th-sort').forEach(th => {
  th.addEventListener('click', () => {
    const k = th.getAttribute('data-sort');
    if (sortState.key === k) sortState.dir = -sortState.dir;
    else sortState = { key: k, dir: 1 };
    renderResults(lastStatusFilter);
  });
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

function final60(g) {
  if (!g) return 0;
  if (typeof g.final60 === 'number' && g.final60 > 0) return g.final60;
  if (g.rawTotal) return g.rawTotal;
  return final20(g) * 3;
}

init();
