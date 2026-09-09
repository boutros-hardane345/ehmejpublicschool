let attendanceRecords = [];

function init() {
  loadQuote();
  document.getElementById('attDate').value = todayStr();
  API.get('/api/classes').then(cls => {
    const sel = document.getElementById('attClass');
    sel.innerHTML = cls.map(c => '<option value="' + c + '">' + c + '</option>').join('');
  });
}

document.getElementById('loadAttendanceBtn').addEventListener('click', loadAttendance);
document.getElementById('saveAttendanceBtn').addEventListener('click', saveAttendance);
document.getElementById('markAllPresent').addEventListener('click', () => setAll('present'));
document.getElementById('markAllAbsent').addEventListener('click', () => setAll('absent'));

async function loadAttendance() {
  const date = document.getElementById('attDate').value;
  const className = document.getElementById('attClass').value;
  if (!date || !className) return;

  try {
    const [attData, students] = await Promise.all([
      API.get('/api/attendance?date=' + date + '&className=' + encodeURIComponent(className)),
      API.get('/api/students?className=' + encodeURIComponent(className))
    ]);

    const existing = attData.length > 0 ? attData[0] : null;

    attendanceRecords = (students.students || []).map(s => {
      const found = existing ? existing.records.find(r => r.studentId === s._id || r.studentName === s.name) : null;
      return {
        studentId: s._id,
        studentName: s.name,
        status: found ? found.status : 'present'
      };
    });

    renderAttendance();
  } catch (e) {
    showToast('Error loading attendance', 'error');
  }
}

function renderAttendance() {
  const grid = document.getElementById('attendanceGrid');
  const stats = document.getElementById('attStats');
  let present = 0, absent = 0;

  grid.innerHTML = attendanceRecords.map(r => {
    const isPresent = r.status === 'present';
    if (isPresent) present++;
    else absent++;
    return '<div class="att-card ' + r.status + '">' +
      '<span class="name">' + escapeHtml(r.studentName) + '</span>' +
      '<div class="toggle">' +
      '<button class="present' + (isPresent ? ' active' : '') + '" onclick="toggleStatus(\'' + r.studentId + '\',\'present\')">Present</button>' +
      '<button class="absent' + (!isPresent ? ' active' : '') + '" onclick="toggleStatus(\'' + r.studentId + '\',\'absent\')">Absent</button>' +
      '</div>' +
      '</div>';
  }).join('');

  document.getElementById('attPresent').textContent = present;
  document.getElementById('attAbsent').textContent = absent;
  document.getElementById('attTotal').textContent = present + absent;
  stats.style.display = '';
  document.getElementById('attendanceEmpty').style.display = 'none';
}

window.toggleStatus = function (studentId, status) {
  const r = attendanceRecords.find(r => r.studentId === studentId);
  if (r) r.status = status;
  renderAttendance();
};

function setAll(status) {
  attendanceRecords.forEach(r => r.status = status);
  renderAttendance();
}

async function saveAttendance() {
  const date = document.getElementById('attDate').value;
  const className = document.getElementById('attClass').value;
  if (!date || !className) return;

  const btn = document.getElementById('saveAttendanceBtn');
  btn.textContent = 'Saving...';
  try {
    await API.post('/api/attendance', {
      date,
      className,
      records: attendanceRecords
    });
    showToast('Attendance saved', 'success');
  } catch (e) {
    showToast('Error saving', 'error');
  }
  btn.textContent = 'Save Attendance';
}

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