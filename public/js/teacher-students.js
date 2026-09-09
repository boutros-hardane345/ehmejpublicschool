let classesData = [];

async function init() {
  const [year, cls, studentsData] = await Promise.all([
    API.get('/api/academic-year'),
    API.get('/api/classes'),
    API.get('/api/students')
  ]);
  classesData = cls;
  const allYears = [...new Set(studentsData.students.map(s => s.academicYear).filter(Boolean))];
  if (!allYears.includes(year.year)) allYears.unshift(year.year);

  populateSelect('cf', cls);
  populateSelect('yf', allYears);
  document.getElementById('yf').value = year.year;

  loadStudents();
  loadQuote();
}

function populateSelect(id, items) {
  const sel = document.getElementById(id);
  sel.innerHTML = '<option value="all">All</option>' + items.map(v => '<option value="' + v + '">' + v + '</option>').join('');
}

async function loadStudents() {
  const cls = document.getElementById('cf').value;
  const yr = document.getElementById('yf').value || 'all';
  const params = new URLSearchParams();
  if (cls !== 'all') params.set('className', cls);
  if (yr !== 'all') params.set('academicYear', yr);
  try {
    const data = await API.get('/api/students?' + params.toString());
    renderTable(data.students);
  } catch (e) {
    document.getElementById('studentTableBody').innerHTML = '<tr><td colspan="4" class="text-center text-muted">Error loading students.</td></tr>';
  }
}

function renderTable(students) {
  const tbody = document.getElementById('studentTableBody');
  document.getElementById('deleteAllBtn').style.display = students.length > 0 ? '' : 'none';
  if (students.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No students found.</td></tr>';
    return;
  }
  tbody.innerHTML = students.map(s =>
    '<tr>' +
    '<td>' + escapeHtml(s.name) + '</td>' +
    '<td><span class="badge badge-neutral">' + escapeHtml(s.className) + '</span></td>' +
    '<td>' + (s.academicYear || 'Not set') + '</td>' +
    '<td><button class="btn btn-danger btn-sm" onclick="deleteStudent(\'' + s._id + '\',this)">Delete</button></td>' +
    '</tr>'
  ).join('');
}

async function deleteStudent(id, btn) {
  if (!confirm('Delete this student?')) return;
  btn.textContent = '...';
  await API.del('/api/students/' + id);
  showToast('Student deleted', 'success');
  loadStudents();
}

document.getElementById('addStudentForm').addEventListener('submit', async function (e) {
  e.preventDefault();
  const name = document.getElementById('sName').value.trim();
  const className = document.getElementById('sClass').value;
  const academicYear = document.getElementById('sYear').value.trim();
  if (!name || !className) return;
  const btn = this.querySelector('button');
  btn.textContent = 'Adding...';
  try {
    await API.post('/api/students', { name, className, academicYear });
    showToast('Student added', 'success');
    this.reset();
    loadStudents();
  } catch (e) {
    showToast('Error adding student', 'error');
  }
  btn.textContent = 'Add Student';
});

document.getElementById('filterBtn').addEventListener('click', loadStudents);

document.getElementById('deleteAllBtn').addEventListener('click', async function () {
  if (!confirm('Remove ALL students and reset all grades/exams to zero? This cannot be undone.')) return;
  this.textContent = 'Removing...';
  await API.del('/api/students');
  showToast('All students removed', 'success');
  loadStudents();
  this.textContent = 'Remove All & Reset Grades';
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

API.get('/api/classes').then(cls => {
  classesData = cls;
  const sel = document.getElementById('sClass');
  sel.innerHTML = '<option value="">Select Class</option>' + cls.map(c => '<option value="' + c + '">' + c + '</option>').join('');
});

init();