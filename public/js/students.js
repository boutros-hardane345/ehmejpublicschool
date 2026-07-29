let currentStudents = [];

async function loadStudents() {
  const className = document.getElementById('sClass').value;
  const academicYear = document.getElementById('sYear').value;
  try {
    const q = `?className=${className}&academicYear=${academicYear}`;
    const data = await API.get(`/api/students${q}`);
    currentStudents = data.students;
    const yearSelect = document.getElementById('sYear');
    yearSelect.innerHTML = data.academicYears.map(y => `<option value="${y}" ${y === academicYear ? 'selected' : ''}>${y}</option>`).join('');
    renderStudents();
  } catch (e) {
    showToast('Error loading students', true);
  }
}

function renderStudents() {
  const tbody = document.getElementById('studentBody');
  const empty = document.getElementById('studentEmpty');
  if (currentStudents.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = currentStudents.map(s => `
    <tr>
      <td><strong>${s.name}</strong></td>
      <td><span class="class-badge">${s.className}</span></td>
      <td>${s.academicYear || '-'}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteStudent('${s._id}')"><i class="fas fa-trash"></i></button></td>
    </tr>
  `).join('');
}

async function addStudent() {
  const name = document.getElementById('sName').value.trim();
  const className = document.getElementById('sNewClass').value;
  const academicYear = document.getElementById('sYearInput').value.trim();
  if (!name) { showToast('Enter a student name', true); return; }
  try {
    await API.post('/api/students', { name, className, academicYear });
    document.getElementById('sName').value = '';
    document.getElementById('sYearInput').value = '';
    showToast('Student added!');
    loadStudents();
  } catch (e) {
    showToast('Error adding student', true);
  }
}

async function deleteStudent(id) {
  if (!confirm('Remove this student?')) return;
  try {
    await API.del(`/api/students/${id}`);
    showToast('Student deleted!');
    loadStudents();
  } catch (e) {
    showToast('Error deleting student', true);
  }
}

async function deleteAllStudents() {
  if (!confirm('Delete ALL students? This cannot be undone.')) return;
  try {
    await API.del('/api/students');
    showToast('All students deleted!');
    loadStudents();
  } catch (e) {
    showToast('Error deleting students', true);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const d = new Date();
  const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  document.getElementById('sYearInput').value = `${y}-${y + 1}`;
  loadStudents();
});
