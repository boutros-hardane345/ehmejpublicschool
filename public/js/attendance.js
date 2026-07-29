let currentRecords = [];
let currentClass = 'Grade 7';
let currentDate = '';
let allAttendanceData = [];

async function loadAttendance() {
  currentClass = document.getElementById('attClass').value;
  currentDate = document.getElementById('attDate').value;
  if (!currentDate) { showToast('Please select a date', true); return; }

  try {
    const data = await API.get(`/api/attendance?date=${currentDate}&className=${currentClass}`);
    if (data.length > 0 && data[0].records) {
      currentRecords = data[0].records;
    } else {
      const students = await API.get(`/api/students?className=${currentClass}`);
      currentRecords = students.students.map(s => ({ studentId: s._id, studentName: s.name, status: 'present' }));
    }
    renderAttendanceTable();
    loadHistory();
  } catch (e) {
    showToast('Error loading attendance', true);
  }
}

function renderAttendanceTable() {
  const tbody = document.getElementById('attBody');
  const stats = document.getElementById('attStats');
  if (currentRecords.length === 0) {
    document.getElementById('attEmpty').style.display = 'block';
    tbody.innerHTML = '';
    stats.style.display = 'none';
    return;
  }
  document.getElementById('attEmpty').style.display = 'none';
  stats.style.display = 'grid';

  const present = currentRecords.filter(r => r.status === 'present').length;
  const absent = currentRecords.filter(r => r.status === 'absent').length;
  document.getElementById('attTotal').textContent = currentRecords.length;
  document.getElementById('attPresent').textContent = present;
  document.getElementById('attAbsent').textContent = absent;
  document.getElementById('attRate').textContent = currentRecords.length ? Math.round(present / currentRecords.length * 100) + '%' : '0%';

  tbody.innerHTML = currentRecords.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${r.studentName}</strong></td>
      <td><span class="${r.status === 'present' ? 'status-present' : 'status-absent'}">${r.status.toUpperCase()}</span></td>
      <td>
        <button class="btn btn-sm ${r.status === 'present' ? 'btn-success' : 'btn-outline'}" onclick="toggleStatus(${i})">
          ${r.status === 'present' ? '<i class="fas fa-check"></i> Present' : '<i class="fas fa-times"></i> Absent'}
        </button>
      </td>
    </tr>
  `).join('');
}

function toggleStatus(index) {
  currentRecords[index].status = currentRecords[index].status === 'present' ? 'absent' : 'present';
  renderAttendanceTable();
}

async function saveAttendance() {
  if (!currentDate) { showToast('Select a date first', true); return; }
  try {
    await API.post('/api/attendance', { date: currentDate, className: currentClass, records: currentRecords });
    showToast('Attendance saved!');
    loadHistory();
  } catch (e) {
    showToast('Error saving attendance', true);
  }
}

async function loadHistory() {
  try {
    allAttendanceData = await API.get('/api/attendance');
    const tbody = document.getElementById('historyBody');
    if (allAttendanceData.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No records yet.</td></tr>';
      return;
    }
    tbody.innerHTML = allAttendanceData.slice(0, 15).map(r => {
      const p = r.records.filter(x => x.status === 'present').length;
      const a = r.records.filter(x => x.status === 'absent').length;
      const rate = r.records.length ? Math.round(p / r.records.length * 100) : 0;
      return `<tr>
        <td>${formatDate(r.date)}</td>
        <td><span class="class-badge">${r.className}</span></td>
        <td class="status-present">${p}</td>
        <td class="status-absent">${a}</td>
        <td><strong>${rate}%</strong></td>
      </tr>`;
    }).join('');
  } catch (e) {
    showToast('Error loading history', true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('attDate').value = todayStr();
  currentDate = todayStr();
  loadAttendance();
});
