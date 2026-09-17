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
  }).catch(function (e) {
    document.getElementById('gradesTableBody').innerHTML = '<tr><td colspan="11" class="text-center text-muted">Error loading grades.</td></tr>';
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
  const nums = [];
  for (let n = 1; n <= 20; n++) nums.push(n);
  sel.innerHTML = '<option value="">N</option>' + nums.map(n =>
    '<option value="' + n + '">' + n + ' DS</option>'
  ).join('');
}

function defaultNumDSForClass(cls) {
  if (cls === 'Grade 7') return 13;
  if (cls === 'Grade 8') return 19;
  if (cls === 'Grade 9') return 10;
  return 3;
}

function getNumDS() {
  const v = parseInt(document.getElementById('gfNumDS').value, 10);
  if (!isNaN(v) && v >= 1 && v <= 20) return v;
  const cls = (document.getElementById('gcf') || {}).value;
  return defaultNumDSForClass(cls);
}

function isHasExam() {
  const el = document.getElementById('gfHasExam');
  if (!el) return true;
  return !!el.checked;
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
  const ds = (g.ds || []).filter(v => typeof v === 'number' && !isNaN(v));
  if (ds.length === 0) return 0;
  return ds.reduce((a, b) => a + b, 0) / ds.length;
}

function hasExamFor(g) {
  if (!g) return true;
  if (g.hasExam !== undefined) return !!g.hasExam;
  return g.semester !== 3 && g.semester !== 6;
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

  // Explicit DS1..DSN columns when viewing a single period (supports 13/19/10), avg otherwise
  const maxDS = isAll ? 0 : Math.max(0, ...grades.map(g => g.numDS || (g.ds || []).length || 0));
  const showExplicitDS = !isAll && maxDS > 0 && maxDS <= 20;
  const thead = document.getElementById('gradesTableHead');
  if (showExplicitDS) {
    let dsHeads = '';
    for (let i = 1; i <= maxDS; i++) dsHeads += '<th>DS' + i + ' /20</th>';
    thead.innerHTML = '<tr><th>Student</th><th>Class</th><th>Year</th><th>Period</th><th>Exam?</th>' + dsHeads + '<th>Exam /20</th><th>Final /20</th><th>Actions</th></tr>';
  } else {
    thead.innerHTML = '<tr><th>Student</th><th>Class</th><th>Year</th><th>Period</th><th>Exam?</th><th>Att /20</th><th>DS avg /20</th><th>Exam /20</th><th>Final /20</th><th>Actions</th></tr>';
  }

  const tbody = document.getElementById('gradesTableBody');
  if (grades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="30" class="text-center text-muted">No grades saved for this view.</td></tr>';
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
      const examBadge = hasExamFor(g) ? '<span class="badge badge-neutral">Exam</span>' : '<span class="badge">No exam</span>';
      if (showExplicitDS) {
        const n = maxDS;
        const ds = g.ds || [];
        let dsCells = '';
        for (let i = 0; i < n; i++) {
          const v = ds[i];
          dsCells += '<td>' + ((v === null || v === undefined || isNaN(v)) ? '<span class="text-muted">—</span>' : Number(v).toFixed(1)) + '</td>';
        }
        const exam20 = hasExamFor(g) ? getExamDisplay20(g) : null;
        const fin20 = final20(g);
        return '<tr><td>' + escapeHtml(s.name) + '</td><td>' + cn + '</td><td>' + (s.academicYear || 'Not set') + '</td><td>' + period + '</td><td>' + examBadge + '</td>' + dsCells + '<td>' + (exam20 === null ? '<span class="text-muted">—</span>' : exam20.toFixed(1)) + '</td><td><strong>' + fin20.toFixed(1) + '</strong></td><td>' + editBtn + '</td></tr>';
      }
      const att20 = getAttendanceDisplay20(g);
      const ds20 = getDSDisplay20(g);
      const exam20 = getExamDisplay20(g);
      const fin20 = final20(g);
      return '<tr><td>' + escapeHtml(s.name) + '</td><td>' + cn + '</td><td>' + (s.academicYear || 'Not set') + '</td><td>' + period + '</td><td>' + examBadge + '</td><td>' + att20.toFixed(1) + '</td><td>' + ds20.toFixed(1) + '</td><td>' + exam20.toFixed(1) + '</td><td><strong>' + fin20.toFixed(1) + '</strong></td><td>' + editBtn + '</td></tr>';
    });
  tbody.innerHTML = rows.join('');
}

window.toggleGradeFields = function () {
  const v = parseInt(document.getElementById('gsPeriod').value, 10);
  const simple = document.getElementById('gfSimple');
  const simpleField = document.getElementById('simpleField');
  // Manual checkbox overrides automatic rule; default checked except Mid/Final
  const hasExamBox = document.getElementById('gfHasExam');
  if (hasExamBox && document.activeElement !== hasExamBox) {
    if (v === 3 || v === 6) hasExamBox.checked = false;
    else if (v) hasExamBox.checked = true;
  }
  const isSimple = false;
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

  // Exam input shown only when checkbox checked; simple legacy field hidden (formula handles no-exam)
  const examInput = document.getElementById('gfExam');
  if (examInput) {
    examInput.closest('div').style.display = isHasExam() ? '' : 'none';
    examInput.required = isHasExam();
  }
  simpleField.style.display = 'none';
  simple.disabled = true;
  simple.required = false;
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
  const hasExamBox = document.getElementById('gfHasExam');
  if (hasExamBox) hasExamBox.checked = (g.hasExam !== undefined ? !!g.hasExam : (g.semester !== 3 && g.semester !== 6));
  toggleGradeFields();
  // Re-apply saved checkbox after toggle defaults
  if (hasExamBox) hasExamBox.checked = (g.hasExam !== undefined ? !!g.hasExam : (g.semester !== 3 && g.semester !== 6));
  toggleGradeFields();
  document.getElementById('gfAtt').value = getAttendanceDisplay20(g).toFixed(1);
  document.getElementById('gfExam').value = getExamDisplay20(g).toFixed(1);
  const numDS = g.numDS || 3;
  const ds = g.ds || [];
  for (let i = 0; i < numDS; i++) {
    const el = document.getElementById('gfDs' + (i + 1));
    if (el) el.value = (ds[i] === null || ds[i] === undefined) ? '' : ds[i];
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

  // Empty DS inputs stay empty (null) so progressive yearly fill averages only filled slots
  const rawDs = [];
  for (let i = 0; i < numDS; i++) {
    const el = document.getElementById('gfDs' + (i + 1));
    rawDs.push(el && el.value !== '' ? el.value : null);
  }
  let body = { studentId, semester, numDS, hasExam: isHasExam(), attendance: document.getElementById('gfAtt').value, ds: rawDs, bigExam: document.getElementById('gfExam').value };

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
