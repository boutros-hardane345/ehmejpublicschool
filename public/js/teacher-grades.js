let periods = [1, 2, 3, 4, 5, 6];
const periodLabels = { 1: 'S1', 2: 'S2', 3: 'Mid-Year', 4: 'S3', 5: 'S4', 6: 'Final-Year' };

function init() {
  loadQuote();
  Promise.all([
    API.get('/api/classes'),
    API.get('/api/period-labels'),
    API.get('/api/periods'),
    API.get('/api/academic-year')
  ]).then(([cls, pl, p, year]) => {
    periods = p;
    Object.assign(periodLabels, pl);
    populateSelect('gcf', cls);
    populatePeriodFilter(pl);
    populateGradeEntryPeriods(pl);
    populateNumDS();
    document.getElementById('gyf').innerHTML = '<option value="' + year.year + '">' + year.year + '</option>';
    document.getElementById('gpf').value = 'all';
    document.getElementById('gsPeriod').value = '1';
    toggleGradeFields();
    loadGrades();
  });
}

function populateSelect(id, items) {
  const sel = document.getElementById(id);
  sel.innerHTML = '<option value="all">All</option>' + items.map(v => '<option value="' + v + '">' + v + '</option>').join('');
}

function populatePeriodFilter(labels) {
  const sel = document.getElementById('gpf');
  sel.innerHTML = '<option value="all">All Periods</option>' + Object.entries(labels).map(([k, v]) =>
    '<option value="' + k + '">' + v + '</option>'
  ).join('');
}

function populateGradeEntryPeriods(labels) {
  const sel = document.getElementById('gsPeriod');
  sel.innerHTML = '<option value="">Period</option>' + Object.entries(labels).map(([k, v]) =>
    '<option value="' + k + '">' + v + '</option>'
  ).join('');
}

function populateNumDS() {
  const sel = document.getElementById('gfNumDS');
  sel.innerHTML = '<option value="">N</option>' + [1,2,3,4,5].map(n =>
    '<option value="' + n + '">' + n + ' DS</option>'
  ).join('');
}

function getNumDS() {
  return parseInt(document.getElementById('gfNumDS').value, 10) || 3;
}

function buildDSFields(numDS) {
  const container = document.getElementById('dsFields');
  container.innerHTML = '';
  for (let i = 0; i < numDS; i++) {
    const div = document.createElement('div');
    div.style.cssText = 'flex:1;min-width:60px';
    div.innerHTML = '<label for="gfDs' + (i + 1) + '">DS' + (i + 1) + ' /20</label>' +
      '<input type="number" id="gfDs' + (i + 1) + '" min="0" max="20" step="0.5" placeholder="DS' + (i + 1) + '">';
    container.appendChild(div);
  }
}

function getDSValues(numDS) {
  const vals = [];
  for (let i = 0; i < numDS; i++) {
    const el = document.getElementById('gfDs' + (i + 1));
    vals.push(parseFloat(el.value) || 0);
  }
  return vals;
}

async function loadGrades() {
  const cls = document.getElementById('gcf').value || 'all';
  const yr = document.getElementById('gyf').value || 'all';
  const sem = document.getElementById('gpf').value || 'all';
  const params = new URLSearchParams({ className: cls, academicYear: yr });
  if (sem !== 'all') params.set('semester', sem);
  try {
    const data = await API.get('/api/grades?' + params.toString());
    syncAcademicYears(data.academicYears, yr);
    populateStudentSelect(data.students);
    renderGradesTable(data, sem);
  } catch (e) {
    document.getElementById('gradesTableBody').innerHTML = '<tr><td colspan="11" class="text-center text-muted">Error loading grades.</td></tr>';
  }
}

function syncAcademicYears(years, selected) {
  if (!years || years.length === 0) return;
  const sel = document.getElementById('gyf');
  const current = selected || sel.value;
  sel.innerHTML = years.map(y => '<option value="' + y + '">' + y + '</option>').join('');
  if (years.includes(current)) sel.value = current;
}

function populateStudentSelect(students) {
  const sel = document.getElementById('gsStudent');
  sel.innerHTML = '<option value="">Select Student</option>' +
    students.map(s => '<option value="' + s._id + '">' + escapeHtml(s.name) + ' (' + s.className + ')</option>').join('');
}

function hasFinal20(g) {
  return g && typeof g.final20 === 'number' && (g.final20 !== 0 || !g.final60 || g.rawTotal <= 20);
}

function final20(g) {
  return hasFinal20(g) ? g.final20 : ((g.final60 || 0) / 3);
}

function getAttendanceDisplay20(g) {
  if (!g) return 0;
  if (hasGrade20(g)) return (g.attendance || 0) / 10 * 20;
  return g.attendance || 0;
}

function getDSDisplay20(g) {
  if (!g) return 0;
  if (hasGrade20(g)) {
    const n = Math.max(1, g.numDS || 1);
    const ds = g.ds || [];
    const sum = ds.slice(0, n).reduce((a, b) => a + b, 0);
    return n > 0 ? sum / n : 0;
  }
  const ds = g.ds || [];
  const sum = ds.slice(0, 3).reduce((a, b) => a + b, 0);
  return sum / 3;
}

function getExamDisplay20(g) {
  if (!g) return 0;
  return g.bigExam || 0;
}

function renderGradesTable(data, semester) {
  const { students, grades } = data;
  const isAll = semester === 'all';
  const sn = parseInt(semester, 10);
  const isSimple = sn === 3 || sn === 6;
  const label = isAll ? 'All Entered Grades' : (periodLabels[sn] || 'Period');
  document.getElementById('gradeTableLabel').textContent = 'Grades - ' + label;
  document.getElementById('gradeCount').textContent = grades.length + ' entered grade' + (grades.length !== 1 ? 's' : '') + ' recorded';

  const thead = document.getElementById('gradesTableHead');
  if (isSimple) {
    thead.innerHTML = '<tr><th>Student</th><th>Class</th><th>Year</th><th>Period</th><th>Grade /20</th><th>Actions</th></tr>';
  } else {
    thead.innerHTML = '<tr><th>Student</th><th>Class</th><th>Year</th><th>Period</th><th>Att /20</th><th>DS avg /20</th><th>Exam /20</th><th>Final /20</th><th>Actions</th></tr>';
  }

  const tbody = document.getElementById('gradesTableBody');
  if (grades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted">No grades saved for this view.</td></tr>';
    return;
  }

  const rows = grades
    .slice()
    .sort((a, b) => a.semester - b.semester)
    .map(g => {
      const s = students.find(st => st._id === g.studentId || st._id.toString() === g.studentId.toString());
      if (!s) return '';
      const cn = '<span class="badge badge-neutral">' + escapeHtml(s.className) + '</span>';
      const period = periodLabels[g.semester] || 'S' + g.semester;
      const editBtn = '<button class="btn btn-secondary btn-sm" onclick="editGrade(\'' + g._id + '\')">Edit</button>';
      if (g.semester === 3 || g.semester === 6) {
        if (!isAll && isSimple) {
          return '<tr><td>' + escapeHtml(s.name) + '</td><td>' + cn + '</td><td>' + (s.academicYear || 'Not set') + '</td><td>' + period + '</td><td><strong>' + final20(g).toFixed(1) + '</strong></td><td>' + editBtn + '</td></tr>';
        }
        return '<tr><td>' + escapeHtml(s.name) + '</td><td>' + cn + '</td><td>' + (s.academicYear || 'Not set') + '</td><td>' + period + '</td><td colspan="4" class="text-muted">Single period grade</td><td><strong>' + final20(g).toFixed(1) + '</strong></td><td>' + editBtn + '</td></tr>';
      }
      const att20 = getAttendanceDisplay20(g);
      const ds20 = getDSDisplay20(g);
      const exam20 = getExamDisplay20(g);
      const fin20 = final20(g);
      return '<tr><td>' + escapeHtml(s.name) + '</td><td>' + cn + '</td><td>' + (s.academicYear || 'Not set') + '</td><td>' + period + '</td><td>' + att20.toFixed(1) + '</td><td>' + ds20.toFixed(1) + '</td><td>' + exam20.toFixed(1) + '</td><td><strong>' + fin20.toFixed(1) + '</strong></td><td>' + editBtn + '</td></tr>';
    });
  tbody.innerHTML = rows.join('');
}

window.toggleGradeFields = function () {
  const v = parseInt(document.getElementById('gsPeriod').value, 10);
  const simple = document.getElementById('gfSimple');
  const simpleField = document.getElementById('simpleField');
  const isSimple = v === 3 || v === 6;
  const numDS = getNumDS();
  buildDSFields(numDS);

  const detailFields = document.getElementById('detailFields');
  if (detailFields) {
    const fields = detailFields.querySelectorAll('div');
    fields.forEach(el => {
      const label = el.querySelector('label');
      if (label && label.textContent.includes('DS')) {
        el.style.display = 'none';
      }
    });
  }

  simpleField.style.display = isSimple ? '' : 'none';
  simple.disabled = !isSimple;
  simple.required = isSimple;

  if (!v) {
    simpleField.style.display = 'none';
    simple.disabled = true;
    simple.required = false;
  }
};

window.editGrade = async function (id) {
  const cls = document.getElementById('gcf').value || 'all';
  const yr = document.getElementById('gyf').value || 'all';
  const data = await API.get('/api/grades?' + new URLSearchParams({ className: cls, academicYear: yr }).toString());
  const g = (data.grades || []).find(item => item._id === id);
  if (!g) return;
  document.getElementById('gsStudent').value = g.studentId;
  document.getElementById('gsPeriod').value = String(g.semester);
  document.getElementById('gfNumDS').value = g.numDS || 3;
  toggleGradeFields();
  if (g.semester === 3 || g.semester === 6) {
    document.getElementById('gfSimple').value = final20(g).toFixed(1);
  } else {
    document.getElementById('gfAtt').value = getAttendanceDisplay20(g).toFixed(1);
    document.getElementById('gfExam').value = getExamDisplay20(g).toFixed(1);
    const numDS = g.numDS || 3;
    const ds = g.ds || [];
    for (let i = 0; i < numDS; i++) {
      const el = document.getElementById('gfDs' + (i + 1));
      if (el) el.value = ds[i] ? (ds[i] / 3).toFixed(1) : '';
    }
  }
  showToast('Grade loaded for editing', 'success');
};

document.getElementById('gradeForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const btn = this.querySelector('button');
  const original = btn.textContent;
  btn.textContent = 'Saving...';
  const studentId = document.getElementById('gsStudent').value;
  const semester = parseInt(document.getElementById('gsPeriod').value, 10);
  if (!studentId || !semester) {
    showToast('Select a student and period', 'error');
    btn.textContent = original;
    return;
  }

  const numDS = getNumDS();
  const dsValues = getDSValues(numDS);

  let body = { studentId, semester, numDS };
  if (semester === 3 || semester === 6) {
    body.bigExam = document.getElementById('gfSimple').value;
  } else {
    body.attendance = document.getElementById('gfAtt').value;
    body.ds = dsValues;
    body.bigExam = document.getElementById('gfExam').value;
  }

  try {
    await API.post('/api/grades', body);
    showToast('Grade saved', 'success');
    this.reset();
    document.getElementById('gsPeriod').value = String(semester);
    document.getElementById('gfNumDS').value = numDS;
    toggleGradeFields();
    loadGrades();
  } catch (e) {
    showToast('Error saving grade', 'error');
  }
  btn.textContent = original;
});

document.getElementById('gradeFilterBtn').addEventListener('click', loadGrades);

document.getElementById('gpf').addEventListener('change', function () {
  if (this.value !== 'all') {
    document.getElementById('gsPeriod').value = this.value;
    toggleGradeFields();
  }
});

document.getElementById('gfNumDS').addEventListener('change', function () {
  toggleGradeFields();
});

document.getElementById('exportGradesPdf').addEventListener('click', function () {
  const sem = document.getElementById('gpf').value;
  if (sem === 'all') {
    showToast('Choose one period before exporting PDF', 'error');
    return;
  }
  const cls = document.getElementById('gcf').value;
  const yr = document.getElementById('gyf').value;
  const params = new URLSearchParams({ class: cls, year: yr, semester: sem || '1' });
  window.location.href = '/teacher/export-semester-pdf?' + params.toString();
});

function loadQuote() {
  API.get('/api/quote').then(q => {
    document.getElementById('sideQuote').textContent = '"' + q.text + '" - ' + q.author;
  });
}

function escapeHtml(t) {
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

init();
