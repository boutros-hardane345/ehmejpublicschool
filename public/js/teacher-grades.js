let periods = [1, 2, 3, 4, 5, 6];
const periodLabels = { 1: 'S1', 2: 'S2', 3: 'Mid-Year', 4: 'S3', 5: 'S4', 6: 'Final-Year' };

function init() {
  loadQuote();
  Promise.all([
    API.get('/api/classes'),
    API.get('/api/period-labels'),
    API.get('/api/academic-year')
  ]).then(([cls, pl, year]) => {
    populateSelect('gcf', cls);
    const sel = document.getElementById('gpf');
    sel.innerHTML = '<option value="">Period</option>' + Object.entries(pl).map(([k, v]) =>
      '<option value="' + k + '">' + v + '</option>'
    ).join('');
    const ySel = document.getElementById('gyf');
    ySel.innerHTML = '<option value="' + year.year + '">' + year.year + '</option>';
    loadGrades();
  });
  API.get('/api/periods').then(p => { periods = p; });
}

function populateSelect(id, items) {
  const sel = document.getElementById(id);
  sel.innerHTML = '<option value="all">All</option>' + items.map(v => '<option value="' + v + '">' + v + '</option>').join('');
}

async function loadGrades() {
  const cls = document.getElementById('gcf').value || 'all';
  const yr = document.getElementById('gyf').value || 'all';
  const sem = document.getElementById('gpf').value || '1';
  const params = new URLSearchParams({ className: cls, academicYear: yr, semester: sem });
  try {
    const data = await API.get('/api/grades?' + params.toString());
    populateStudentSelect(data.students);
    renderGradesTable(data, parseInt(sem));
  } catch (e) {
    document.getElementById('gradesTableBody').innerHTML = '<tr><td colspan="11" class="text-center text-muted">Error loading grades.</td></tr>';
  }
}

function populateStudentSelect(students) {
  const sel = document.getElementById('gsStudent');
  sel.innerHTML = '<option value="">Select Student</option>' +
    students.map(s => '<option value="' + s._id + '">' + escapeHtml(s.name) + ' (' + s.className + ')</option>').join('');
}

function renderGradesTable(data, semester) {
  const { students, grades } = data;
  const isSimple = semester === 3 || semester === 6;
  const label = periodLabels[semester] || 'All Periods';
  document.getElementById('gradeTableLabel').textContent = 'Grades \u2014 ' + label;
  document.getElementById('gradeCount').textContent = grades.length + ' grade' + (grades.length !== 1 ? 's' : '') + ' recorded';

  const thead = document.getElementById('gradesTableHead');
  if (isSimple) {
    thead.innerHTML = '<tr><th>Student</th><th>Class</th><th>Year</th><th>Period</th><th>Grade /60</th></tr>';
  } else {
    thead.innerHTML = '<tr><th>Student</th><th>Class</th><th>Year</th><th>Period</th><th>Att /6</th><th>DS1 /8</th><th>DS2 /8</th><th>DS3 /8</th><th>Exam /30</th><th>Raw</th><th>Final /60</th></tr>';
  }

  const tbody = document.getElementById('gradesTableBody');
  if (grades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="' + (isSimple ? 5 : 11) + '" class="text-center text-muted">No grades saved for this period.</td></tr>';
    return;
  }

  tbody.innerHTML = grades.map(g => {
    const s = students.find(st => st._id === g.studentId || st._id.toString() === g.studentId.toString());
    if (!s) return '';
    const cn = '<span class="badge badge-neutral">' + escapeHtml(s.className) + '</span>';
    if (isSimple) {
      return '<tr><td>' + escapeHtml(s.name) + '</td><td>' + cn + '</td><td>' + (s.academicYear || 'Not set') + '</td><td>' + (periodLabels[g.semester] || 'S' + g.semester) + '</td><td><strong>' + (g.final60 || 0).toFixed(1) + '</strong></td></tr>';
    }
    return '<tr><td>' + escapeHtml(s.name) + '</td><td>' + cn + '</td><td>' + (s.academicYear || 'Not set') + '</td><td>' + (periodLabels[g.semester] || 'S' + g.semester) + '</td><td>' + (g.attendance || 0).toFixed(1) + '</td><td>' + ((g.ds && g.ds[0]) || 0).toFixed(1) + '</td><td>' + ((g.ds && g.ds[1]) || 0).toFixed(1) + '</td><td>' + ((g.ds && g.ds[2]) || 0).toFixed(1) + '</td><td>' + (g.bigExam || 0).toFixed(1) + '</td><td><strong>' + (g.rawTotal || 0).toFixed(1) + '</strong></td><td><strong>' + (g.final60 || 0).toFixed(1) + '</strong></td></tr>';
  }).join('');
}

window.toggleGradeFields = function () {
  const v = parseInt(document.getElementById('gsPeriod').value);
  const detailIds = ['gfAtt', 'gfDs1', 'gfDs2', 'gfDs3', 'gfExam'];
  const simple = document.getElementById('gfSimple');
  const simpleField = document.getElementById('simpleField');
  const isSimple = v === 3 || v === 6;

  detailIds.forEach(id => {
    const el = document.getElementById(id);
    const parent = el.closest('div');
    parent.style.display = isSimple ? 'none' : '';
    el.disabled = isSimple;
    el.required = !isSimple;
  });

  simpleField.style.display = isSimple ? '' : 'none';
  simple.disabled = !isSimple;
  simple.required = isSimple;

  if (!v) {
    detailIds.forEach(id => {
      const el = document.getElementById(id);
      const parent = el.closest('div');
      parent.style.display = '';
      el.disabled = false;
    });
    simpleField.style.display = 'none';
    simple.disabled = true;
  }
};

document.getElementById('gradeForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const btn = this.querySelector('button');
  btn.textContent = 'Saving...';
  const studentId = document.getElementById('gsStudent').value;
  const semester = parseInt(document.getElementById('gsPeriod').value);
  if (!studentId || !semester) return;

  let body = { studentId, semester };

  if (semester === 3 || semester === 6) {
    body.bigExam = document.getElementById('gfSimple').value;
  } else {
    body.attendance = document.getElementById('gfAtt').value;
    body.ds1 = document.getElementById('gfDs1').value;
    body.ds2 = document.getElementById('gfDs2').value;
    body.ds3 = document.getElementById('gfDs3').value;
    body.bigExam = document.getElementById('gfExam').value;
  }

  try {
    await API.post('/api/grades', body);
    showToast('Grade saved', 'success');
    loadGrades();
  } catch (e) {
    showToast('Error saving grade', 'error');
  }
  btn.textContent = 'Save Grade';
});

document.getElementById('gradeFilterBtn').addEventListener('click', loadGrades);

document.getElementById('exportGradesPdf').addEventListener('click', function () {
  const cls = document.getElementById('gcf').value;
  const yr = document.getElementById('gyf').value;
  const sem = document.getElementById('gpf').value;
  const params = new URLSearchParams({ class: cls, year: yr, semester: sem || '1' });
  window.location.href = '/teacher/export-semester-pdf?' + params.toString();
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

init();